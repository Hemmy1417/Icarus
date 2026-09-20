"""A randomized walk over the whole contract, checking after every accepted
action that the things which must always be true still are.

Scripted tests prove the paths somebody thought of. This one drives actions in
orders nobody wrote down, and asserts conservation, immutability and the state
machine after each step. It found nothing on the first run only because the
run before it found something; keep it in the suite."""
import json
import random

import pytest

from conftest import (  # noqa: F401
    GEN, INSPECTOR, INSTALLER, OWNER, STRANGER, as_, err, judge_all, judge_answer, jfif,
    llm, look_all, project_params, set_now, terms, transfers,
)

ACTORS = (OWNER, INSTALLER, INSPECTOR, STRANGER)
CLOCK = ["2026-09-20T09:00:00Z", "2026-10-19T09:00:00Z", "2026-10-21T09:00:00Z",
         "2026-10-25T09:00:00Z", "2026-11-05T09:00:00Z"]


class World:
    """What the walk knows about what it has done, so it can check the chain
    against its own memory rather than against the chain."""

    def __init__(self, module, c):
        self.module, self.c = module, c
        self.projects, self.milestones, self.items = [], [], []
        self.funded = 0            # every wei ever sent into the contract
        self.settled = {}          # mid -> the record at the moment it settled
        self.rounds = {}           # "mid|n" -> the record when it was written
        self.filed = {}            # eid -> (meta, body)
        self.states = set()        # every milestone state the walk reached
        self.did = {}              # action -> how many times it actually landed

    # ── the checks ───────────────────────────────────────────────────────────

    def check(self):
        c = self.c
        held, credited, claimed = 0, 0, 0
        ledger = []
        for who in ACTORS:
            row = json.loads(c.get_balance(who))
            credited += int(row["claimable"])
            claimed += int(row["claimed"])
            ledger.append(row)
        assert all(int(r["claimable"]) >= 0 for r in ledger)
        assert sum(t["wei"] for t in transfers()) == claimed, "a transfer without a claim"

        paid_total = 0
        for pid in self.projects:
            p = json.loads(c.get_project(pid))
            escrow, reserved = int(p["escrow_wei"]), int(p["reserved_wei"])
            held += escrow
            assert 0 <= reserved <= escrow, f"{pid} reserved more than it holds"
            assert int(p["funded_wei"]) == escrow + int(p["paid_wei"]) + int(p["returned_wei"])
            assert p["state"] in ("PROPOSED", "ACTIVE", "CANCELLED")
            ms = [_settledform(json.loads(c.get_milestone(s["milestone_id"])))
                  for s in p["milestone_summaries"]]
            assert reserved == sum(int(m["reserved_wei"]) for m in ms), f"{pid} reservation drifted"
            paid_here = 0
            for m in ms:
                self.states.add(m["state"])
                assert m["state"] in (
                    "AWAITING_TERMS", "AWAITING_EVIDENCE", "ACCEPTED", "REJECTED",
                    "UNDETERMINED", "APPEALED", "FINALIZED", "CLOSED")
                if m["state"] in ("FINALIZED", "CLOSED"):
                    assert m["reserved_wei"] == "0", f"{m['milestone_id']} settled but reserved"
                    prior = self.settled.setdefault(m["milestone_id"], m)
                    assert prior == m, f"{m['milestone_id']} changed after it settled"
                if m["state"] == "FINALIZED":
                    paid_here += int(self._payment(m))
                if m["state"] == "APPEALED":
                    assert m["appeal"] and m["standing"]
                    assert m["standing"]["appealed"] is True
                if m["state"] == "ACCEPTED":
                    assert m["standing"] and m["standing"]["decision"] == "ACCEPTED"
                # every round ever written stays exactly as it was written
                for n in range(1, int(m["rounds_count"]) + 1):
                    key = f"{m['milestone_id']}|{n}"
                    rec = json.loads(c.get_round(m["milestone_id"], n))
                    assert self.rounds.setdefault(key, rec) == rec, f"round {key} changed"
                with pytest.raises(err(self.module)):
                    c.get_round(m["milestone_id"], int(m["rounds_count"]) + 1)
            assert int(p["paid_wei"]) == paid_here, f"{pid} paid does not match its milestones"
            paid_total += int(p["paid_wei"])
            if p["state"] == "CANCELLED":
                assert escrow == 0 and reserved == 0

        assert held + credited + claimed == self.funded, "value was created or destroyed"
        stats = json.loads(self.c.get_stats())
        assert int(stats["paid_wei"]) == paid_total

        for eid, before in self.filed.items():
            assert (json.loads(c.get_item(eid)), self._body(eid)) == before, f"{eid} changed"

    def _payment(self, m):
        cur = int(m["current_version"] or 0) or len(m["versions"])
        return m["versions"][cur - 1]["payment_wei"]

    def _body(self, eid):
        it = json.loads(self.c.get_item(eid))
        return self.c.get_image(eid) if it["kind"] == "IMAGE" else None

    # ── the actions ──────────────────────────────────────────────────────────

    def remember_item(self, eid):
        self.items.append(eid)
        self.filed[eid] = (json.loads(self.c.get_item(eid)), self._body(eid))


def _settledform(m):
    """A milestone as the record holds it: the view also stamps the instant it
    was read, which is not part of the record."""
    m.pop("now", None)
    return m


def _landed(w, name):
    w.did[name] = w.did.get(name, 0) + 1


def _progress(w, rng):
    """Do the next sensible thing for one milestone. Pure randomness rarely
    signs a project before filing evidence, so the walk would never see the
    states that matter; this keeps the orders varied but the machine moving."""
    c, module = w.c, w.module
    if not w.milestones:
        return
    mid = rng.choice(w.milestones)
    m = json.loads(c.get_milestone(mid))
    pid = m["project_id"]
    p = json.loads(c.get_project(pid))
    if p["state"] == "PROPOSED":
        as_(module, INSTALLER, 0)
        c.accept_project(pid)
        _landed(w, "accept_project")
        return
    if p["state"] == "CANCELLED":
        return
    version = int(m["current_version"] or 0)
    if version < 1:
        as_(module, INSTALLER, 0)
        c.accept_version(mid, int(m["pending_version"] or 1))
        _landed(w, "accept_version")
        return
    mine = [it for it in m["evidence"].get(str(version), [])
            if it["role"] == "INSTALLER" and it["kind"] == "IMAGE"]
    if m["state"] in ("AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED", "APPEALED")             and len(mine) < 2:
        as_(module, INSTALLER, 0)
        eid = json.loads(c.submit_image(mid, json.dumps(
            {"requirement_id": "R1", "caption": f"view {len(w.items)}",
             "origin": rng.choice(["PHOTO", "NAMEPLATE"])}),
            jfif(str(len(w.items)).encode())))["item_id"]
        w.remember_item(eid)
        _landed(w, "submit_image")
        return
    if m["state"] in ("AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED"):
        ids = [it["item_id"] for it in mine][:4]
        lines = {f"E{i}": rng.choice(["INSTALLED", "INSTALLED", "ABSENT", "UNIDENTIFIED"])
                 for i in (1, 2, 3)}
        llm(look=look_all(n_images=2),
            judge=judge_answer(lines, {"C1": rng.choice(["MET", "MET", "UNCLEAR"])},
                               basis={k: ids for k in list(lines) + ["C1"]}))
        as_(module, INSTALLER, 0)
        c.request_assessment(mid, json.dumps(ids))
        _landed(w, "request_assessment")
        # An appeal has to be opened inside its window, and the walk's clock
        # moves in days, so take the chance while the window is certainly open.
        after = json.loads(c.get_milestone(mid))
        standing = after.get("standing") or {}
        if standing.get("appealable") and rng.randrange(2) == 0:
            who = OWNER if standing["decision"] == "ACCEPTED" else INSTALLER
            as_(module, who, 0)
            c.open_appeal(mid, "The specified inverter is the one on the wall.")
            _landed(w, "open_appeal")
        return
    if m["state"] in ("ACCEPTED", "REJECTED") and m["standing"]             and m["standing"]["appealable"] and not m["standing"]["appealed"]:
        who = OWNER if m["standing"]["decision"] == "ACCEPTED" else INSTALLER
        as_(module, who, 0)
        c.open_appeal(mid, "The specified inverter is the one on the wall.")
        _landed(w, "open_appeal")
        return
    if m["state"] == "APPEALED":
        llm(look=look_all(n_images=2), judge=judge_all(basis={}))
        as_(module, rng.choice(ACTORS), 0)
        rng.choice([lambda: (c.decide_appeal(mid), _landed(w, "decide_appeal")),
                    lambda: (c.lapse_appeal(mid), _landed(w, "lapse_appeal"))])()
        return
    if m["state"] == "ACCEPTED":
        as_(module, rng.choice(ACTORS), 0)
        c.finalize(mid)
        _landed(w, "finalize")
        return
    as_(module, rng.choice(ACTORS), 0)
    c.close_milestone(mid)
    _landed(w, "close_milestone")


def _act(w, rng):
    """One legal-looking attempt. A refusal is a fine outcome: the point is
    that the contract's own rules decide, and nothing breaks either way."""
    c, module = w.c, w.module
    who = rng.choice(ACTORS)
    choice = rng.randrange(12)
    if w.projects and rng.randrange(3) == 0:
        return _progress(w, rng)
    as_(module, who, 0)

    if choice == 0 or not w.projects:
        wei = rng.choice([0, GEN, 5 * GEN])
        as_(module, who, wei)
        out = json.loads(c.create_project(project_params(
            INSTALLER if who != INSTALLER else OWNER,
            inspector=rng.choice(["", INSPECTOR]),
            appeal_window_seconds=rng.choice([600, 3600]))))
        w.funded += wei
        if out["refused"] is False:
            w.projects.append(out["project_id"])
            _landed(w, "create_project")
        return

    pid = rng.choice(w.projects)
    mid = rng.choice(w.milestones) if w.milestones else None

    if choice == 1:
        wei = rng.choice([GEN, 3 * GEN])
        as_(module, who, wei)
        json.loads(c.fund_project(pid))
        w.funded += wei
        _landed(w, "fund_project")
    elif choice == 2:
        out = json.loads(c.add_milestone(pid, terms(
            payment_wei=str(rng.choice([GEN, 2 * GEN])),
            deadline=rng.choice(["2026-10-20T12:00:00Z", "2026-10-24T12:00:00Z"]))))
        w.milestones.append(out["milestone_id"])
        _landed(w, "add_milestone")
    elif choice == 3:
        c.accept_project(pid)
        _landed(w, "accept_project")
    elif choice == 4:
        c.accept_inspector_role(pid)
        _landed(w, "accept_inspector_role")
    elif choice == 5 and mid:
        eid = json.loads(c.submit_image(mid, json.dumps(
            {"requirement_id": "R1", "equipment_id": rng.choice(["", "E1", "E2"]),
             "caption": f"view {len(w.items)}", "origin": rng.choice(["PHOTO", "NAMEPLATE"])}),
            jfif(str(len(w.items)).encode())))["item_id"]
        w.remember_item(eid)
        _landed(w, "submit_image")
    elif choice == 6 and mid:
        eid = json.loads(c.submit_document(mid, json.dumps({"title": "Datasheet"}),
                                           "Volterra VT-50K inverter."))["item_id"]
        w.remember_item(eid)
        _landed(w, "submit_document")
    elif choice == 7 and mid:
        m = json.loads(c.get_milestone(mid))
        version = int(m["current_version"] or 0)
        mine = [it["item_id"] for it in m["evidence"].get(str(version), [])
                if it["role"] == "INSTALLER" and it["kind"] != "DECLARATION"][:4]
        lines = {f"E{i}": rng.choice(["INSTALLED", "UNIDENTIFIED", "ABSENT"]) for i in (1, 2, 3)}
        llm(look=look_all(n_images=2),
            judge=judge_answer(lines, {"C1": rng.choice(["MET", "UNCLEAR"])},
                               basis={k: mine for k in list(lines) + ["C1"]}))
        c.request_assessment(mid, json.dumps(mine))
        _landed(w, "request_assessment")
    elif choice == 8 and mid:
        c.open_appeal(mid, "The inverter on the wall is the specified one.")
        _landed(w, "open_appeal")
    elif choice == 9 and mid:
        llm(look=look_all(n_images=2), judge=judge_all(basis={}))
        c.decide_appeal(mid)
        _landed(w, "decide_appeal")
    elif choice == 10 and mid:
        settle = rng.choice(["finalize", "close_milestone", "lapse_appeal"])
        getattr(c, settle)(mid)
        _landed(w, settle)
    elif choice == 11:
        money = rng.choice(["claim", "withdraw_escrow", "cancel_project"])
        if money == "claim":
            c.claim()
        elif money == "withdraw_escrow":
            c.withdraw_escrow(pid, str(GEN))
        else:
            c.cancel_project(pid)
        _landed(w, money)


@pytest.mark.parametrize("seed", range(6))
def test_random_play_preserves_every_invariant(module, c, seed):
    _walk(module, c, seed)


def test_the_walk_actually_reaches_the_whole_state_machine(module, c):
    """A green walk that never finalized anything proves nothing. Across a
    long run every milestone state must be reached and every action must
    land, or the walk is checking an empty room."""
    w = _walk(module, c, seed=101, steps=900)
    assert w.states == set(module.MILESTONE_STATES), sorted(w.states)
    for action in ("create_project", "fund_project", "add_milestone", "accept_project",
                   "accept_inspector_role", "submit_image", "submit_document",
                   "request_assessment", "open_appeal", "decide_appeal", "finalize",
                   "close_milestone", "lapse_appeal", "claim", "withdraw_escrow",
                   "cancel_project"):
        assert w.did.get(action, 0) >= 1, f"the walk never landed {action}: {w.did}"


def _walk(module, c, seed, steps=120):
    rng = random.Random(seed)
    w = World(module, c)
    set_now(CLOCK[0])
    for step in range(steps):
        if rng.randrange(14) == 0:
            set_now(CLOCK[min(len(CLOCK) - 1, rng.randrange(len(CLOCK)))])
        try:
            _act(w, rng)
        except module.gl.vm.UserError:
            pass          # a refusal is a legitimate outcome
        except KeyError as e:
            raise AssertionError(f"step {step}: a missing key escaped as a crash: {e}")
        except (TypeError, ValueError, IndexError, AttributeError) as e:
            raise AssertionError(f"step {step}: {type(e).__name__} escaped instead of "
                                 f"a refusal in words: {e}")
        w.check()
    return w
