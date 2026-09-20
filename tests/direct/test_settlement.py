"""Appeal, readjudication and settlement: the paths where money moves, and
every wall in front of them."""
import json

import pytest

from conftest import (  # noqa: F401
    GEN, INSPECTOR, INSTALLER, OWNER, STRANGER, active_milestone, as_, assess, claimable,
    declaration, document, err, image, judge_all, judge_answer, llm, look_all, milestone,
    project, rounds, set_now, terms, transfers,
)


def accepted(module, c, **kw):
    """A milestone with a standing acceptance on two images."""
    pid, mid = active_milestone(module, c, **kw)
    a = image(module, c, mid, caption="The array", line="E1")
    b = image(module, c, mid, caption="The inverter", line="E2", origin="NAMEPLATE")
    out = assess(module, c, mid, [a, b],
                 judge=judge_answer({"E1": "INSTALLED", "E2": "INSTALLED", "E3": "INSTALLED"},
                                    {"C1": "MET"}, basis={k: [a, b] for k in
                                                          ("E1", "E2", "E3", "C1")}))
    assert out["decision"] == "ACCEPTED"
    return pid, mid, [a, b]


def rejected(module, c, **kw):
    pid, mid = active_milestone(module, c, **kw)
    a = image(module, c, mid, caption="The roof", line="E1")
    b = image(module, c, mid, caption="The wall", line="E2")
    out = assess(module, c, mid, [a, b],
                 judge=judge_answer({"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"},
                                    {"C1": "MET"}, basis={k: [a, b] for k in
                                                          ("E1", "E2", "E3", "C1")}))
    assert out["decision"] == "REJECTED"
    return pid, mid, [a, b]


class TestTheWindow:
    def test_an_acceptance_pays_only_after_its_window(self, module, c):
        pid, mid, _ = accepted(module, c)
        as_(module, STRANGER)
        with pytest.raises(err(module), match="appeal window is still open"):
            c.finalize(mid)
        set_now("2026-09-20T10:30:00Z")
        out = json.loads(c.finalize(mid))
        assert out["credited_wei"] == str(2 * GEN)
        assert claimable(c, INSTALLER) == 2 * GEN
        assert transfers() == [], "finalizing credits a claim and pushes nothing"
        p = project(c, pid)
        assert p["paid_wei"] == str(2 * GEN) and p["reserved_wei"] == "0"

    def test_only_an_acceptance_is_finalized(self, module, c):
        _, mid, _ = rejected(module, c)
        set_now("2026-09-20T10:30:00Z")
        as_(module, STRANGER)
        with pytest.raises(err(module), match="only a standing acceptance"):
            c.finalize(mid)

    def test_finalizing_twice_is_refused(self, module, c):
        _, mid, _ = accepted(module, c)
        set_now("2026-09-20T10:30:00Z")
        as_(module, STRANGER)
        c.finalize(mid)
        with pytest.raises(err(module), match="only a standing acceptance"):
            c.finalize(mid)

    def test_nobody_files_against_a_standing_acceptance(self, module, c):
        _, mid, _ = accepted(module, c)
        as_(module, OWNER)
        with pytest.raises(err(module), match="to contest it, open an appeal"):
            c.submit_document(mid, "{}", "We disagree.")

    def test_the_installer_cannot_reassess_over_an_acceptance(self, module, c):
        _, mid, items = accepted(module, c)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="an acceptance stands"):
            c.request_assessment(mid, json.dumps(items))


class TestTheAppeal:
    def test_the_owner_appeals_an_acceptance_and_the_installer_a_rejection(self, module, c):
        _, mid, _ = accepted(module, c)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="only the owner appeals"):
            c.open_appeal(mid, "grounds")
        as_(module, STRANGER)
        with pytest.raises(err(module), match="only the owner appeals"):
            c.open_appeal(mid, "grounds")
        as_(module, OWNER)
        out = json.loads(c.open_appeal(mid, "The inverter is not the specified model."))
        assert out["against"] == "ACCEPTED"
        assert milestone(c, mid)["state"] == "APPEALED"

    def test_a_rejection_is_appealed_by_the_installer(self, module, c):
        _, mid, _ = rejected(module, c)
        as_(module, OWNER)
        with pytest.raises(err(module), match="only the installer appeals"):
            c.open_appeal(mid, "grounds")
        as_(module, INSTALLER)
        c.open_appeal(mid, "The inverter is on the wall in the second photograph.")

    def test_an_appeal_needs_grounds_and_a_window(self, module, c):
        _, mid, _ = accepted(module, c)
        as_(module, OWNER)
        with pytest.raises(err(module), match="state the grounds"):
            c.open_appeal(mid, "   ")
        set_now("2026-09-20T10:30:00Z")
        with pytest.raises(err(module), match="appeal window has closed"):
            c.open_appeal(mid, "too late")

    def test_a_decision_is_appealed_once(self, module, c):
        _, mid, _ = accepted(module, c)
        as_(module, OWNER)
        c.open_appeal(mid, "grounds")
        set_now("2026-09-20T10:30:00Z")
        llm(look=look_all(), judge=judge_all())
        as_(module, STRANGER)
        c.decide_appeal(mid)
        as_(module, OWNER)
        with pytest.raises(err(module), match="no decision open to appeal"):
            c.open_appeal(mid, "again")

    def test_every_party_may_answer_during_the_evidence_period(self, module, c):
        _, mid, _ = accepted(module, c, inspector=INSPECTOR)
        as_(module, OWNER)
        c.open_appeal(mid, "The inverter is not the specified model.")
        answer = document(module, c, mid, who=INSPECTOR, title="Second inspection",
                          text="The unit on the wall reads Volterra VT-50K.")
        assert json.loads(c.get_item(answer))["role"] == "INSPECTOR"
        as_(module, OWNER)
        with pytest.raises(err(module), match="at most 2 new documents"):
            for _ in range(3):
                c.submit_document(mid, "{}", "more")

    def test_the_readjudication_reads_the_recorded_evidence_and_what_came_after(self, module, c):
        _, mid, items = accepted(module, c)
        as_(module, OWNER)
        c.open_appeal(mid, "The inverter is not the specified model.")
        fresh = image(module, c, mid, who=OWNER, req="", caption="A different wall")
        set_now("2026-09-20T10:30:00Z")
        llm(look=look_all(n_images=2), judge=judge_all(basis={}))
        as_(module, STRANGER)
        out = json.loads(c.decide_appeal(mid))
        assert out["reviewed_round"] == 1
        assert out["new_items"] == [fresh]
        record = rounds(c, mid, 2)
        assert record["kind"] == "APPEAL"
        assert [row["item_id"] for row in record["evidence"]] == items + [fresh]
        assert [row["item_id"] for row in record["evidence"] if row["new"]] == [fresh]
        assert rounds(c, mid, 1)["decision"] == "ACCEPTED", "the first decision still stands on record"

    def test_the_readjudication_waits_for_the_evidence_period(self, module, c):
        _, mid, _ = accepted(module, c)
        as_(module, OWNER)
        c.open_appeal(mid, "grounds")
        as_(module, STRANGER)
        with pytest.raises(err(module), match="evidence period is still open"):
            c.decide_appeal(mid)

    def test_an_appeal_that_upholds_an_acceptance_pays_at_once(self, module, c):
        _, mid, _ = accepted(module, c)
        as_(module, OWNER)
        c.open_appeal(mid, "grounds")
        set_now("2026-09-20T10:30:00Z")
        llm(look=look_all(n_images=2), judge=judge_all(basis={}))
        as_(module, STRANGER)
        assert json.loads(c.decide_appeal(mid))["decision"] == "ACCEPTED"
        as_(module, STRANGER)
        c.finalize(mid)
        assert claimable(c, INSTALLER) == 2 * GEN

    def test_an_appeal_nobody_decides_lapses_to_doubt(self, module, c):
        _, mid, _ = accepted(module, c)
        as_(module, OWNER)
        c.open_appeal(mid, "grounds")
        as_(module, STRANGER)
        with pytest.raises(err(module), match="three days after"):
            c.lapse_appeal(mid)
        set_now("2026-09-24T12:00:00Z")
        assert json.loads(c.lapse_appeal(mid))["state"] == "UNDETERMINED"
        m = milestone(c, mid)
        assert m["appeal"] is None and m["standing"]["kind"] == "APPEAL_LAPSED"
        as_(module, STRANGER)
        with pytest.raises(err(module), match="only a standing acceptance"):
            c.finalize(mid)


class TestClosing:
    def test_a_milestone_nobody_accepted_closes_and_frees_its_reservation(self, module, c):
        pid, mid, _ = rejected(module, c)
        as_(module, STRANGER)
        with pytest.raises(err(module), match="deadline has not passed"):
            c.close_milestone(mid)
        set_now("2026-10-21T00:00:00Z")
        out = json.loads(c.close_milestone(mid))
        assert out["released_wei"] == str(2 * GEN)
        p = project(c, pid)
        assert p["reserved_wei"] == "0" and p["unreserved_wei"] == p["escrow_wei"]
        as_(module, OWNER)
        c.withdraw_escrow(pid, p["escrow_wei"])
        assert claimable(c, OWNER) == int(p["escrow_wei"])

    def test_closing_waits_for_a_standing_decision_window(self, module, c):
        """A rejection recorded just before the deadline still has a window in
        which the installer may appeal; the milestone cannot be closed out
        from under them."""
        set_now("2026-10-20T11:30:00Z")
        _, mid, _ = rejected(module, c)
        set_now("2026-10-20T12:15:00Z")          # past the deadline, inside the window
        as_(module, STRANGER)
        with pytest.raises(err(module), match="appeal window is still open"):
            c.close_milestone(mid)
        set_now("2026-10-20T12:31:00Z")          # the window has passed too
        c.close_milestone(mid)

    def test_an_acceptance_is_finalized_not_closed(self, module, c):
        _, mid, _ = accepted(module, c)
        set_now("2026-10-21T00:00:00Z")
        as_(module, STRANGER)
        with pytest.raises(err(module), match="it is finalized, not closed"):
            c.close_milestone(mid)

    def test_an_open_appeal_blocks_closing(self, module, c):
        _, mid, _ = accepted(module, c)
        as_(module, OWNER)
        c.open_appeal(mid, "grounds")
        set_now("2026-10-21T00:00:00Z")
        as_(module, STRANGER)
        with pytest.raises(err(module), match="decide it or let it lapse first"):
            c.close_milestone(mid)

    def test_closing_waits_for_terms_the_installer_can_still_sign(self, module, c):
        _, mid = active_milestone(module, c, escrow=9 * GEN)
        as_(module, OWNER)
        c.propose_version(mid, terms(deadline="2026-11-01T12:00:00Z"))
        set_now("2026-10-21T00:00:00Z")
        as_(module, STRANGER)
        with pytest.raises(err(module), match="await the installer's signature"):
            c.close_milestone(mid)
        set_now("2026-11-02T00:00:00Z")
        c.close_milestone(mid)

    def test_a_settled_milestone_is_never_closed_again(self, module, c):
        _, mid, _ = rejected(module, c)
        set_now("2026-10-21T00:00:00Z")
        as_(module, STRANGER)
        c.close_milestone(mid)
        with pytest.raises(err(module), match="already settled"):
            c.close_milestone(mid)

    def test_nothing_is_filed_or_assessed_after_settlement(self, module, c):
        _, mid, items = rejected(module, c)
        set_now("2026-10-21T00:00:00Z")
        as_(module, STRANGER)
        c.close_milestone(mid)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="the milestone is settled"):
            c.submit_image(mid, "{}", b"\x89PNG\r\n\x1a\n" + b"0" * 100)
        with pytest.raises(err(module), match="the milestone is settled"):
            c.request_assessment(mid, json.dumps(items))


class TestCancellationNeverRewritesHistory:
    def test_cancelling_leaves_a_milestone_that_already_closed_alone(self, module, c):
        """A milestone whose unsigned terms expired can be closed by anyone
        while the project is still unsigned. Cancelling the project afterwards
        must not rewrite that settled record."""
        from conftest import create_project
        pid = create_project(module, c, escrow=5 * GEN)
        as_(module, OWNER)
        mid = json.loads(c.add_milestone(pid, terms()))["milestone_id"]
        set_now("2026-10-21T00:00:00Z")
        as_(module, STRANGER)
        c.close_milestone(mid)
        before = milestone(c, mid)
        assert before["state"] == "CLOSED"
        assert before["close_reason"] == "the deadline passed with nothing accepted"
        as_(module, OWNER)
        c.cancel_project(pid)
        after = milestone(c, mid)
        assert after["close_reason"] == before["close_reason"]
        assert after["closed_at"] == before["closed_at"]
        assert claimable(c, OWNER) == 5 * GEN


def test_every_refusal_reads_as_a_sentence(module, c):
    """A refusal is the only thing a person sees when the contract says no.
    One of them once read "only the owner appeals a accepted decision", which
    is what a format string gives you when nobody reads its output."""
    import re
    _, mid, _ = accepted(module, c)
    seen = []
    for who, call in ((INSTALLER, lambda: c.open_appeal(mid, "grounds")),
                      (STRANGER, lambda: c.open_appeal(mid, "grounds")),
                      (STRANGER, lambda: c.finalize(mid)),
                      (OWNER, lambda: c.submit_document(mid, "{}", "We object."))):
        as_(module, who)
        try:
            call()
        except Exception as e:          # noqa: BLE001  (any refusal is the subject)
            seen.append(str(e).replace("[EXPECTED] ", ""))
    assert seen, "no refusal was produced"
    for sentence in seen:
        assert not re.search(r"\ba [aeiou]", sentence), f"wrong article: {sentence}"
        assert not re.search(r"\ban [^aeiou]", sentence), f"wrong article: {sentence}"
        assert sentence == sentence.lstrip(), f"leading space: {sentence!r}"
        assert "  " not in sentence, f"doubled space: {sentence!r}"
        assert sentence[0].islower(), f"a refusal is a clause, not a title: {sentence!r}"
