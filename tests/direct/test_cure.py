"""The cure round: what a decision that fell short leaves the installer able
to put right, what it keeps from that decision, and how long it is heard.

Two things must hold. A cure judges only what was left open, so a finding a
panel already agreed cannot be lost to a second reading. And nothing carried
forward is out of the owner's reach: an appeal judges every line again, on
everything the chain of rounds read."""
import json

import pytest

from conftest import (  # noqa: F401
    GEN, INSPECTOR, INSTALLER, OWNER, STRANGER, active_milestone, as_, assess, claimable,
    declaration, document, err, forge_leader, image, judge_all, judge_answer, llm, look_all,
    milestone, project, prints, prompts, reset_prompts, rounds, set_now, terms, transfers,
    web_page,
)

ALL = ("E1", "E2", "E3", "C1")


def fell_short(module, c, lines=None, criteria=None, conflicts=False, **kw):
    """A milestone whose first assessment left something open. By default the
    inverter is found absent and everything else is found in place."""
    pid, mid = active_milestone(module, c, **kw)
    a = image(module, c, mid, caption="The array", line="E1")
    b = image(module, c, mid, caption="The wall", line="E2")
    found = {"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"}
    found.update(lines or {})
    out = assess(module, c, mid, [a, b], judge=judge_answer(
        found, criteria or {"C1": "MET"}, conflicts=conflicts, basis={k: [a, b] for k in ALL}))
    assert out["decision"] in ("REJECTED", "UNDETERMINED")
    return pid, mid, [a, b]


def cure(module, c, mid, items, judge, **kw):
    llm(look=look_all(), judge=judge, **kw)
    as_(module, INSTALLER)
    return json.loads(c.request_cure(mid, json.dumps(items)))


def nameplate(module, c, mid):
    return image(module, c, mid, caption="The inverter nameplate", line="E2", origin="NAMEPLATE")


class TestWhatACureJudges:
    def test_a_cure_rates_only_what_was_left_open_and_keeps_the_rest(self, module, c):
        pid, mid, first = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        reset_prompts()
        set_now("2026-09-20T09:20:00Z")
        out = cure(module, c, mid, [fresh],
                   judge_answer({"E2": "INSTALLED"}, basis={"E2": [fresh]}))
        assert out["decision"] == "ACCEPTED"
        assert out["lines"] == {"E1": "INSTALLED", "E2": "INSTALLED", "E3": "INSTALLED"}
        assert out["criteria"] == {"C1": "MET"}
        assert out["carried"] == {"from_round": 1, "lines": ["E1", "E3"], "criteria": ["C1"]}

        prompt = prompts(kind="judge", role="leader")[0]["prompt"]
        schedule, rest = prompt.split("ACCEPTANCE CRITERIA", 1)
        assert "E2 inverter: Volterra VT-50K" in schedule
        assert "E1 module" not in schedule and "E3 mounting" not in schedule
        assert "This is a CURE of round 1" in prompt
        settled = rest.split("This is a CURE of round 1", 1)[1].split("Your own reading", 1)[0]
        assert "E1 module: Helion Solar HX-550M" in settled
        assert "E3 mounting: Ridgeline RL-Flat" in settled
        assert "C1: The array is installed to the approved layout" in settled
        assert "E2 inverter" not in settled
        assert rest.split("This is a CURE", 1)[0].count("- none") == 1, \
            "no criterion was left open, and the prompt says so"

        record = rounds(c, mid, 2)
        assert record["kind"] == "CURE" and record["version"] == 1
        assert record["carried"] == out["carried"] and record["reviewed_round"] is None
        assert [row["item_id"] for row in record["evidence"]] == [fresh]
        assert record["evidence"][0]["new"] is True
        assert record["chain"] == first + [fresh]
        assert record["decisive"] == {"lines": ["E1", "E2", "E3"], "criteria": ["C1"]}
        assert record["quality"] == "SUFFICIENT"
        assert rounds(c, mid, 1)["carried"] is None and rounds(c, mid, 1)["chain"] == first

        m = milestone(c, mid)
        assert m["state"] == "ACCEPTED" and m["version_assessments"] == 2
        assert m["standing"]["kind"] == "CURE" and m["standing"]["appealable"] is True
        assert m["standing"]["window_ends"] == "2026-09-20T10:20:00Z"
        assert json.loads(c.get_stats())["cures"] == 1
        assert project(c, pid)["milestone_summaries"][0]["state"] == "ACCEPTED"

    def test_a_cured_acceptance_pays_whole_after_its_window(self, module, c):
        pid, mid, _ = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        cure(module, c, mid, [fresh], judge_answer({"E2": "INSTALLED"}, basis={"E2": [fresh]}))
        as_(module, STRANGER)
        with pytest.raises(err(module), match="appeal window is still open"):
            c.finalize(mid)
        set_now("2026-09-20T10:00:01Z")
        assert json.loads(c.finalize(mid))["credited_wei"] == str(2 * GEN)
        assert claimable(c, INSTALLER) == 2 * GEN

    def test_a_finding_already_agreed_cannot_be_lost_to_a_second_reading(self, module, c):
        _, mid, _ = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [fresh], judge_answer(
            {"E1": "ABSENT", "E2": "INSTALLED", "E3": "NOT_SHOWN"}, {"C1": "NOT_MET"},
            basis={k: [fresh] for k in ALL}))
        assert out["decision"] == "ACCEPTED"
        assert out["lines"]["E1"] == "INSTALLED" and out["criteria"]["C1"] == "MET"

    def test_a_validator_is_held_to_the_open_lines_only(self, module, c):
        _, mid, _ = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [fresh],
                   judge_answer({"E2": "INSTALLED"}, basis={"E2": [fresh]}),
                   v_judge=judge_answer({"E1": "ABSENT", "E2": "INSTALLED"}, {"C1": "NOT_MET"},
                                        basis={k: [fresh] for k in ALL}))
        assert out["decision"] == "ACCEPTED"

    def test_a_validator_that_sees_the_open_line_differently_does_not_confirm(self, module, c):
        _, mid, _ = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        with pytest.raises(err(module), match="did not agree"):
            cure(module, c, mid, [fresh],
                 judge_answer({"E2": "INSTALLED"}, basis={"E2": [fresh]}),
                 v_judge=judge_answer({"E2": "UNIDENTIFIED"}, basis={"E2": [fresh]}))
        assert milestone(c, mid)["rounds_count"] == 1

    def test_open_criteria_are_rated_and_met_ones_are_not(self, module, c):
        _, mid, _ = fell_short(module, c, lines={"E2": "INSTALLED"}, criteria={"C1": "UNCLEAR"})
        fresh = image(module, c, mid, caption="The array against the drawing")
        reset_prompts()
        out = cure(module, c, mid, [fresh], judge_answer({}, {"C1": "MET"},
                                                        basis={"C1": [fresh]}))
        assert out["decision"] == "ACCEPTED"
        assert out["carried"] == {"from_round": 1, "lines": ["E1", "E2", "E3"], "criteria": []}
        prompt = prompts(kind="judge", role="leader")[0]["prompt"]
        schedule = prompt.split("ACCEPTANCE CRITERIA", 1)[0]
        assert schedule.rstrip().endswith("- none")
        assert "- C1: The array is installed" in prompt.split("This is a CURE", 1)[0]

    def test_the_floor_holds_in_a_cure(self, module, c):
        """A datasheet cannot install an inverter in a cure round either."""
        _, mid, _ = fell_short(module, c)
        sheet = document(module, c, mid, line="E2")
        out = cure(module, c, mid, [sheet],
                   judge_answer({"E2": "INSTALLED"}, basis={"E2": [sheet]}))
        assert out["decision"] == "UNDETERMINED" and out["lines"]["E2"] == "NOT_SHOWN"
        assert rounds(c, mid, 2)["quality"] == "INSUFFICIENT"
        assert rounds(c, mid, 2)["decisive"] == {"lines": [], "criteria": []}

    def test_a_cure_that_still_finds_the_line_absent_rejects_again(self, module, c):
        _, mid, _ = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [fresh], judge_answer({"E2": "ABSENT"}, basis={"E2": [fresh]}))
        assert out["decision"] == "REJECTED"
        assert rounds(c, mid, 2)["decisive"] == {"lines": ["E2"], "criteria": []}
        m = milestone(c, mid)
        assert m["state"] == "REJECTED" and m["standing"]["appealable"] is True

    def test_conflicting_new_evidence_leaves_the_milestone_in_doubt(self, module, c):
        _, mid, _ = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [fresh], judge_answer(
            {"E2": "INSTALLED"}, conflicts=True, basis={"E2": [fresh]}))
        assert out["decision"] == "UNDETERMINED" and out["quality"] == "CONFLICTING"
        assert milestone(c, mid)["standing"]["appealable"] is False

    def test_a_node_that_did_not_see_the_images_cannot_confirm_a_cure(self, module, c):
        _, mid, _ = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        with pytest.raises(err(module), match="did not agree"):
            cure(module, c, mid, [fresh],
                 judge_answer({"E2": "INSTALLED"}, basis={"E2": [fresh]}),
                 v_look=look_all(received=False))

    def test_the_other_parties_items_are_always_read(self, module, c):
        _, mid, _ = fell_short(module, c, inspector=INSPECTOR)
        report = document(module, c, mid, who=INSPECTOR, title="Site inspection",
                          text="The inverter on the wall is a Volterra VT-50K.")
        counter = image(module, c, mid, who=OWNER, req="", caption="The wall on Tuesday")
        fresh = nameplate(module, c, mid)
        cure(module, c, mid, [fresh], judge_answer({"E2": "INSTALLED"}, basis={"E2": [fresh]}))
        record = rounds(c, mid, 2)
        assert [row["item_id"] for row in record["evidence"]] == [fresh, report, counter]
        assert all(row["new"] for row in record["evidence"])

    def test_an_older_item_may_be_named_beside_a_new_one(self, module, c):
        _, mid, first = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        cure(module, c, mid, [first[1], fresh],
             judge_answer({"E2": "INSTALLED"}, basis={"E2": [fresh]}))
        record = rounds(c, mid, 2)
        assert [(row["item_id"], row["new"]) for row in record["evidence"]] == \
            [(first[1], False), (fresh, True)]
        assert record["new_item_ids"] == [fresh]
        assert record["chain"] == first + [fresh], "an item is in the chain once"

    def test_a_second_cure_carries_from_the_first(self, module, c):
        _, mid, first = fell_short(module, c, lines={"E3": "NOT_SHOWN"})
        one = nameplate(module, c, mid)
        out = cure(module, c, mid, [one], judge_answer(
            {"E2": "INSTALLED", "E3": "NOT_SHOWN"}, basis={"E2": [one], "E3": [one]}))
        assert out["decision"] == "UNDETERMINED"
        assert out["carried"]["lines"] == ["E1"]
        two = image(module, c, mid, caption="The ballast frames", line="E3")
        reset_prompts()
        out = cure(module, c, mid, [two], judge_answer({"E3": "INSTALLED"}, basis={"E3": [two]}))
        assert out["decision"] == "ACCEPTED"
        assert out["carried"] == {"from_round": 2, "lines": ["E1", "E2"], "criteria": ["C1"]}
        assert "This is a CURE of round 2" in prompts(kind="judge", role="leader")[0]["prompt"]
        assert rounds(c, mid, 3)["chain"] == first + [one, two]
        assert milestone(c, mid)["version_assessments"] == 3

    def test_nothing_is_carried_that_the_panel_did_not_agree(self, module, c):
        """A leader that sees equipment the validators do not cannot put it
        on the record in a round that falls short anyway, to be carried by a
        later cure and paid on."""
        _, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="Something blurred", line="E1")
        b = image(module, c, mid, caption="Something else", line="E3")
        with pytest.raises(err(module), match="did not agree"):
            assess(module, c, mid, [a, b],
                   judge=judge_answer({"E1": "INSTALLED", "E2": "NOT_SHOWN", "E3": "INSTALLED"},
                                      {"C1": "MET"}, basis={k: [a, b] for k in ALL}),
                   v_judge=judge_answer({"E1": "NOT_SHOWN", "E2": "NOT_SHOWN", "E3": "NOT_SHOWN"},
                                        {"C1": "UNCLEAR"}, basis={k: [a, b] for k in ALL}))
        llm(look=look_all(), judge=judge_answer(
            {"E1": "NOT_SHOWN", "E2": "NOT_SHOWN", "E3": "NOT_SHOWN"}, {"C1": "UNCLEAR"}, basis={}))
        forge_leader({"images_received": True, "conflicts": False,
                      "lines": {"E1": "INSTALLED", "E2": "NOT_SHOWN", "E3": "INSTALLED"},
                      "criteria": {"C1": "MET"}, "notes": {"reasoning": "trust me"}})
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="did not agree"):
            c.request_assessment(mid, json.dumps([a, b]))
        assert milestone(c, mid)["rounds_count"] == 0

    def test_a_carried_finding_cannot_be_forged_inside_a_cure_either(self, module, c):
        _, mid, _ = fell_short(module, c, lines={"E3": "NOT_SHOWN"})
        fresh = nameplate(module, c, mid)
        with pytest.raises(err(module), match="did not agree"):
            cure(module, c, mid, [fresh],
                 judge_answer({"E2": "INSTALLED", "E3": "NOT_SHOWN"}, basis={"E2": [fresh]}),
                 v_judge=judge_answer({"E2": "UNIDENTIFIED", "E3": "NOT_SHOWN"},
                                      basis={"E2": [fresh]}))

class TestWhoMayAskAndWhen:
    def test_only_the_installer_asks(self, module, c):
        _, mid, _ = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        for who in (OWNER, STRANGER):
            as_(module, who)
            with pytest.raises(err(module), match="only the installer asks for a cure"):
                c.request_cure(mid, json.dumps([fresh]))

    def test_a_cure_answers_a_decision_that_fell_short(self, module, c):
        _, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="The array", line="E1")
        b = image(module, c, mid, caption="The inverter", line="E2")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="answers a decision that fell short"):
            c.request_cure(mid, json.dumps([a]))
        assess(module, c, mid, [a, b], judge=judge_all(basis={k: [a, b] for k in ALL}))
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="answers a decision that fell short"):
            c.request_cure(mid, json.dumps([a]))

    def test_a_decision_in_doubt_can_be_cured_too(self, module, c):
        _, mid, _ = fell_short(module, c, lines={"E2": "UNIDENTIFIED"})
        assert milestone(c, mid)["state"] == "UNDETERMINED"
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [fresh], judge_answer({"E2": "INSTALLED"},
                                                        basis={"E2": [fresh]}))
        assert out["decision"] == "ACCEPTED"

    @pytest.mark.parametrize("lines,conflicts", [
        ({"E2": "INSTALLED"}, True), ({"E2": "CONTRADICTED"}, False)])
    def test_a_decision_that_found_conflict_is_cured_with_nothing_kept(self, module, c, lines,
                                                                      conflicts):
        """Evidence at odds with itself, as a whole or on one line, settles
        no finding. The decision can still be put right, but the cure round
        judges every line and every condition: nothing is carried."""
        _, mid, first = fell_short(module, c, lines=lines, conflicts=conflicts)
        assert milestone(c, mid)["state"] == "UNDETERMINED"
        assert milestone(c, mid)["cure_until"] == "2026-10-20T12:00:00Z"
        fresh = nameplate(module, c, mid)
        reset_prompts()
        out = cure(module, c, mid, [first[0], fresh],
                   judge_all(basis={k: [fresh] for k in ALL}))
        assert out["decision"] == "ACCEPTED"
        assert out["carried"] == {"from_round": 1, "lines": [], "criteria": []}
        schedule = prompts(kind="judge", role="leader")[0]["prompt"].split("ACCEPTANCE", 1)[0]
        assert "E1 module" in schedule and "E2 inverter" in schedule and "E3 mounting" in schedule

    def test_a_cure_of_a_conflict_must_establish_every_line_again(self, module, c):
        _, mid, first = fell_short(module, c, lines={"E2": "INSTALLED"}, conflicts=True)
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [first[0], fresh], judge_answer(
            {"E1": "NOT_SHOWN", "E2": "INSTALLED", "E3": "NOT_SHOWN"}, {"C1": "MET"},
            basis={k: [fresh] for k in ALL}))
        assert out["decision"] == "UNDETERMINED" and out["lines"]["E1"] == "NOT_SHOWN"

    def test_a_cure_that_keeps_nothing_needs_the_evidence_the_terms_require(self, module, c):
        """The terms ask for two photographs from the installer. A cure that
        judges every line again is a full reading, and one new photograph
        with the old ones dropped is not what the parties signed for."""
        _, mid, first = fell_short(module, c, lines={"E2": "INSTALLED"}, conflicts=True)
        fresh = nameplate(module, c, mid)
        llm(look=look_all(), judge=judge_all(basis={k: [fresh] for k in ALL}))
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="needs 2 items from the installer"):
            c.request_cure(mid, json.dumps([fresh]))
        out = json.loads(c.request_cure(mid, json.dumps([first[0], fresh])))
        assert out["decision"] == "ACCEPTED"

    def test_a_cure_that_keeps_something_is_not_held_to_the_requirements_again(self, module, c):
        _, mid, _ = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [fresh], judge_answer({"E2": "INSTALLED"},
                                                        basis={"E2": [fresh]}))
        assert out["decision"] == "ACCEPTED"

    def test_a_lapsed_appeal_leaves_nothing_to_carry(self, module, c):
        _, mid, _ = fell_short(module, c)
        as_(module, INSTALLER)
        c.open_appeal(mid, "The wall is the right wall.")
        fresh = nameplate(module, c, mid)
        set_now("2026-09-23T10:00:01Z")
        as_(module, STRANGER)
        c.lapse_appeal(mid)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="never confirmed on appeal"):
            c.request_cure(mid, json.dumps([fresh]))

    def test_a_lapsed_appeal_leaves_no_cure_period_on_the_record(self, module, c):
        _, mid, _ = fell_short(module, c)
        assert milestone(c, mid)["cure_until"]
        as_(module, INSTALLER)
        c.open_appeal(mid, "The wall is the right wall.")
        set_now("2026-09-23T10:00:01Z")
        as_(module, STRANGER)
        c.lapse_appeal(mid)
        assert milestone(c, mid)["cure_until"] is None

    def test_a_rejection_upheld_on_appeal_can_still_be_cured(self, module, c):
        _, mid, first = fell_short(module, c)
        as_(module, INSTALLER)
        c.open_appeal(mid, "The wall is the right wall.")
        set_now("2026-09-20T10:00:01Z")
        llm(look=look_all(), judge=judge_answer(
            {"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"}, {"C1": "MET"},
            basis={k: first for k in ALL}))
        as_(module, STRANGER)
        assert json.loads(c.decide_appeal(mid))["decision"] == "REJECTED"
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [fresh], judge_answer({"E2": "INSTALLED"},
                                                        basis={"E2": [fresh]}))
        assert out["decision"] == "ACCEPTED" and out["carried"]["from_round"] == 2

    @pytest.mark.parametrize("raw", ["{", '"ev-000003"', '{"a": 1}'])
    def test_the_items_are_named_as_a_list(self, module, c, raw):
        _, mid, _ = fell_short(module, c)
        nameplate(module, c, mid)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="JSON list of item ids"):
            c.request_cure(mid, raw)

    def test_a_cure_rests_on_something_filed_since_the_decision(self, module, c):
        _, mid, first = fell_short(module, c)
        as_(module, INSTALLER)
        for named in ("", "[]", json.dumps(first), json.dumps([7, None])):
            with pytest.raises(err(module), match="filed since the decision"):
                c.request_cure(mid, named)
        said = declaration(module, c, mid)
        with pytest.raises(err(module), match="is a declaration"):
            c.request_cure(mid, json.dumps([said]))

    def test_an_item_held_back_from_the_decision_is_not_new(self, module, c):
        """Filed before the decision and not presented to it: that is the
        same evidence, kept in a pocket, not something put right since."""
        pid, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="The array", line="E1")
        b = image(module, c, mid, caption="The wall", line="E2")
        held = nameplate(module, c, mid)
        assess(module, c, mid, [a, b], judge=judge_answer(
            {"E1": "INSTALLED", "E2": "NOT_SHOWN", "E3": "INSTALLED"}, {"C1": "MET"},
            basis={k: [a, b] for k in ALL}))
        assert milestone(c, mid)["standing"]["item_mark"] == 3
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="filed since the decision"):
            c.request_cure(mid, json.dumps([held]))
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [held, fresh],
                   judge_answer({"E2": "INSTALLED"}, basis={"E2": [fresh]}))
        assert out["decision"] == "ACCEPTED"
        assert [(r["item_id"], r["new"]) for r in rounds(c, mid, 2)["evidence"]] == \
            [(held, False), (fresh, True)]

    def test_what_is_named_follows_the_rules_of_any_round(self, module, c):
        pid, mid, first = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        theirs = image(module, c, mid, who=OWNER, req="", caption="The wall on Tuesday")
        as_(module, OWNER)
        other = json.loads(c.add_milestone(pid, terms(payment_wei=str(GEN))))["milestone_id"]
        as_(module, INSTALLER)
        c.accept_version(other, 1)
        elsewhere = image(module, c, other, caption="Another roof")
        as_(module, INSTALLER)
        for named, match in (([fresh, elsewhere], "is not evidence filed against these terms"),
                             ([fresh, theirs], "was filed by the owner"),
                             ([fresh, fresh], "is named twice")):
            with pytest.raises(err(module), match=match):
                c.request_cure(mid, json.dumps(named))

    def test_a_cure_reads_no_more_from_the_installer_than_any_round(self, module, c):
        _, mid, first = fell_short(module, c)
        more = [image(module, c, mid, caption=f"View {i}") for i in range(3)]
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="at most 4 images from the installer"):
            c.request_cure(mid, json.dumps(first + more))
        sheets = [document(module, c, mid, title=f"Sheet {i}") for i in range(5)]
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="at most 4 documents from the installer"):
            c.request_cure(mid, json.dumps(sheets))
        out = cure(module, c, mid, first + more[:2] + sheets[:4],
                   judge_answer({"E2": "INSTALLED"}, basis={"E2": [more[0]]}))
        assert out["decision"] == "ACCEPTED"

    def test_cures_and_assessments_share_one_allowance(self, module, c):
        _, mid, first = fell_short(module, c)
        for n in range(4):
            fresh = image(module, c, mid, caption=f"Attempt {n}", line="E2")
            out = cure(module, c, mid, [fresh],
                       judge_answer({"E2": "ABSENT"}, basis={"E2": [fresh]}))
            assert out["decision"] == "REJECTED"
        assert milestone(c, mid)["version_assessments"] == 5
        last = image(module, c, mid, caption="Attempt 5", line="E2")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="the 5 assessments they allow"):
            c.request_cure(mid, json.dumps([last]))
        with pytest.raises(err(module), match="the 5 assessments they allow"):
            c.request_assessment(mid, json.dumps(first))


class TestTheCurePeriod:
    def test_a_decision_long_before_the_deadline_is_cured_until_the_deadline(self, module, c):
        pid, mid, _ = fell_short(module, c)
        assert milestone(c, mid)["cure_until"] == "2026-10-20T12:00:00Z"
        assert project(c, pid)["milestone_summaries"][0]["cure_until"] == "2026-10-20T12:00:00Z"
        set_now("2026-10-20T12:00:00Z")
        fresh = nameplate(module, c, mid)
        set_now("2026-10-20T12:00:01Z")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="period for curing this decision has ended"):
            c.request_cure(mid, json.dumps([fresh]))

    def test_a_decision_at_the_deadline_leaves_one_window_to_cure(self, module, c):
        set_now("2026-10-20T11:30:00Z")
        _, mid, first = fell_short(module, c)
        assert milestone(c, mid)["cure_until"] == "2026-10-20T12:30:00Z"
        set_now("2026-10-20T12:20:00Z")
        fresh = nameplate(module, c, mid)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="a full assessment is no longer heard"):
            c.request_assessment(mid, json.dumps(first))
        set_now("2026-10-20T12:30:00Z")
        out = cure(module, c, mid, [fresh], judge_answer({"E2": "INSTALLED"},
                                                        basis={"E2": [fresh]}))
        assert out["decision"] == "ACCEPTED"

    def test_evidence_is_filed_through_the_cure_period_and_not_after(self, module, c):
        set_now("2026-10-20T11:30:00Z")
        _, mid, _ = fell_short(module, c)
        set_now("2026-10-20T12:30:00Z")
        nameplate(module, c, mid)
        set_now("2026-10-20T12:30:01Z")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="no cure period is open"):
            c.submit_document(mid, "{}", "A late datasheet.")

    def test_a_cure_round_never_renews_the_period(self, module, c):
        set_now("2026-10-20T11:30:00Z")
        _, mid, _ = fell_short(module, c)
        set_now("2026-10-20T12:25:00Z")
        fresh = nameplate(module, c, mid)
        cure(module, c, mid, [fresh], judge_answer({"E2": "ABSENT"}, basis={"E2": [fresh]}))
        m = milestone(c, mid)
        assert m["cure_until"] == "2026-10-20T12:30:00Z"
        assert m["standing"]["window_ends"] == "2026-10-20T13:25:00Z"
        set_now("2026-10-20T12:30:01Z")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="no cure period is open"):
            c.submit_image(mid, "{}", b"\xff\xd8\xff\xe0late")
        with pytest.raises(err(module), match="period for curing this decision has ended"):
            c.request_cure(mid, json.dumps([fresh]))

    def test_an_accepted_assessment_opens_no_cure_period(self, module, c):
        _, mid, first = fell_short(module, c)
        assert milestone(c, mid)["cure_until"]
        assess(module, c, mid, first, judge=judge_all(basis={k: first for k in ALL}))
        assert milestone(c, mid)["cure_until"] is None

    @pytest.mark.parametrize("leader,validator,why", [
        ("CONTRADICTED", "NOT_SHOWN", "the leader reports a conflict this node does not see"),
        ("NOT_SHOWN", "CONTRADICTED", "this node sees a conflict the leader does not report"),
        ("CONTRADICTED", "UNIDENTIFIED", "the leader reports a conflict this node does not see"),
    ])
    def test_a_contradicted_line_is_not_one_nodes_to_declare_or_to_hide(
            self, module, c, leader, validator, why):
        """Whether a line is contradicted decides whether there is a cure
        at all, so it is not a shade of doubt and both nodes must find it."""
        _, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="The array", line="E1")
        b = image(module, c, mid, caption="The wall", line="E2")
        basis = {k: [a, b] for k in ALL}
        with pytest.raises(err(module), match="did not agree"):
            assess(module, c, mid, [a, b],
                   judge=judge_answer({"E1": "INSTALLED", "E2": leader, "E3": "INSTALLED"},
                                      {"C1": "MET"}, basis=basis),
                   v_judge=judge_answer({"E1": "INSTALLED", "E2": validator, "E3": "INSTALLED"},
                                        {"C1": "MET"}, basis=basis))
        assert any(why in p for p in prints() if "[DISAGREE]" in p)
        assert milestone(c, mid)["rounds_count"] == 0

    def test_a_conflict_flag_and_a_contradicted_line_are_the_same_finding(self, module, c):
        _, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="The array", line="E1")
        b = image(module, c, mid, caption="The wall", line="E2")
        basis = {k: [a, b] for k in ALL}
        out = assess(module, c, mid, [a, b],
                     judge=judge_answer({"E1": "INSTALLED", "E2": "NOT_SHOWN", "E3": "INSTALLED"},
                                        {"C1": "MET"}, conflicts=True, basis=basis),
                     v_judge=judge_answer({"E1": "INSTALLED", "E2": "CONTRADICTED",
                                           "E3": "INSTALLED"}, {"C1": "MET"}, basis=basis))
        assert out["decision"] == "UNDETERMINED"
        assert rounds(c, mid, 1)["conflicts_detected"] is True

    def test_the_last_round_the_terms_allow_opens_no_cure_period(self, module, c):
        _, mid, first = fell_short(module, c)
        for n in range(3):
            assess(module, c, mid, first, judge=judge_answer(
                {"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"}, {"C1": "MET"},
                basis={k: first for k in ALL}))
            assert milestone(c, mid)["cure_until"] == "2026-10-20T12:00:00Z"
        assess(module, c, mid, first, judge=judge_answer(
            {"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"}, {"C1": "MET"},
            basis={k: first for k in ALL}))
        m = milestone(c, mid)
        assert m["version_assessments"] == 5 and m["cure_until"] is None

    def test_a_cure_round_that_finds_conflict_unsettles_what_it_had_kept(self, module, c):
        """The cure period runs on. But the next cure carries nothing, not
        even the lines the first decision found in place: the latest
        decision is the one a cure answers, and it settled nothing."""
        _, mid, _ = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        cure(module, c, mid, [fresh], judge_answer(
            {"E2": "INSTALLED"}, conflicts=True, basis={"E2": [fresh]}))
        assert milestone(c, mid)["cure_until"] == "2026-10-20T12:00:00Z"
        again = image(module, c, mid, caption="The whole plant room", line="E2")
        out = cure(module, c, mid, [fresh, again], judge_all(basis={k: [again] for k in ALL}))
        assert out["carried"] == {"from_round": 2, "lines": [], "criteria": []}
        assert out["decision"] == "ACCEPTED"

    def test_an_appeal_that_takes_an_acceptance_away_leaves_time_to_cure(self, module, c):
        """The installer whose acceptance falls on the owner's appeal, after
        the deadline, is not left with no way to answer."""
        set_now("2026-10-20T11:30:00Z")
        pid, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="The array", line="E1")
        b = image(module, c, mid, caption="The inverter", line="E2")
        assess(module, c, mid, [a, b], judge=judge_all(basis={k: [a, b] for k in ALL}))
        as_(module, OWNER)
        c.open_appeal(mid, "The inverter is not the one specified.")
        set_now("2026-10-20T12:30:01Z")
        llm(look=look_all(), judge=judge_answer(
            {"E1": "INSTALLED", "E2": "UNIDENTIFIED", "E3": "INSTALLED"}, {"C1": "MET"},
            basis={k: [a, b] for k in ALL}))
        as_(module, STRANGER)
        assert json.loads(c.decide_appeal(mid))["decision"] == "UNDETERMINED"
        assert milestone(c, mid)["cure_until"] == "2026-10-20T13:30:01Z"
        with pytest.raises(err(module), match="period for curing the last decision"):
            c.close_milestone(mid)
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [fresh], judge_answer({"E2": "INSTALLED"},
                                                        basis={"E2": [fresh]}))
        assert out["decision"] == "ACCEPTED" and out["carried"]["from_round"] == 2

    def test_the_installers_own_appeal_opens_no_new_cure_period(self, module, c):
        set_now("2026-10-20T11:30:00Z")
        _, mid, first = fell_short(module, c)               # cure until 12:30
        as_(module, INSTALLER)
        c.open_appeal(mid, "The wall is the right wall.")
        set_now("2026-10-20T12:30:01Z")
        llm(look=look_all(), judge=judge_answer(
            {"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"}, {"C1": "MET"},
            basis={k: first for k in ALL}))
        as_(module, STRANGER)
        assert json.loads(c.decide_appeal(mid))["decision"] == "REJECTED"
        assert milestone(c, mid)["cure_until"] == "2026-10-20T12:30:00Z"
        assert json.loads(c.close_milestone(mid))["state"] == "CLOSED"

    def test_any_acceptance_ends_the_cure_period(self, module, c):
        _, mid, first = fell_short(module, c)
        assert milestone(c, mid)["cure_until"] == "2026-10-20T12:00:00Z"
        fresh = nameplate(module, c, mid)
        cure(module, c, mid, [fresh], judge_answer({"E2": "INSTALLED"}, basis={"E2": [fresh]}))
        assert milestone(c, mid)["cure_until"] is None, "accepted by a cure round"

    def test_an_installers_appeal_that_wins_ends_the_cure_period(self, module, c):
        _, mid, first = fell_short(module, c)
        as_(module, INSTALLER)
        c.open_appeal(mid, "The wall is the right wall.")
        set_now("2026-09-20T10:00:01Z")
        llm(look=look_all(), judge=judge_all(basis={k: first for k in ALL}))
        as_(module, STRANGER)
        assert json.loads(c.decide_appeal(mid))["decision"] == "ACCEPTED"
        assert milestone(c, mid)["cure_until"] is None

    def test_signing_new_terms_ends_the_cure_period(self, module, c):
        _, mid, _ = fell_short(module, c)
        as_(module, OWNER)
        c.propose_version(mid, terms(title="Revised installation"))
        as_(module, INSTALLER)
        c.accept_version(mid, 2)
        assert milestone(c, mid)["cure_until"] is None

    def test_closing_is_held_by_a_cure_period_that_outlasts_the_appeal_window(self, module, c):
        set_now("2026-10-20T11:30:00Z")
        _, mid, _ = fell_short(module, c)                   # cure until 12:30
        set_now("2026-10-20T12:25:00Z")
        fresh = nameplate(module, c, mid)
        cure(module, c, mid, [fresh], judge_answer(
            {"E2": "NOT_SHOWN"}, basis={"E2": [fresh]}))   # in doubt: no appeal window
        as_(module, STRANGER)
        with pytest.raises(err(module), match="period for curing the last decision"):
            c.close_milestone(mid)
        set_now("2026-10-20T12:30:00Z")
        with pytest.raises(err(module), match="period for curing the last decision"):
            c.close_milestone(mid)
        set_now("2026-10-20T12:30:01Z")
        out = json.loads(c.close_milestone(mid))
        assert out["state"] == "CLOSED" and milestone(c, mid)["cure_until"] is None


class TestTheOwnersReach:
    def test_an_appeal_of_a_cured_acceptance_judges_every_line_on_the_whole_chain(self, module, c):
        _, mid, first = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        cure(module, c, mid, [fresh], judge_answer({"E2": "INSTALLED"}, basis={"E2": [fresh]}))
        as_(module, OWNER)
        c.open_appeal(mid, "The array is not the specified module.")
        counter = image(module, c, mid, who=OWNER, req="", caption="A module label")
        set_now("2026-09-20T10:00:01Z")
        reset_prompts()
        everything = first + [fresh, counter]
        llm(look=look_all(), judge=judge_answer(
            {"E1": "ABSENT", "E2": "INSTALLED", "E3": "INSTALLED"}, {"C1": "MET"},
            basis={k: everything for k in ALL}))
        as_(module, STRANGER)
        out = json.loads(c.decide_appeal(mid))
        assert out["decision"] == "REJECTED" and out["new_items"] == [counter]
        record = rounds(c, mid, 3)
        assert [row["item_id"] for row in record["evidence"]] == everything
        assert record["chain"] == everything and record["carried"] is None
        assert record["lines"]["E1"] == "ABSENT", "a carried line is judged again on appeal"
        prompt = prompts(kind="judge", role="leader")[0]["prompt"]
        assert "E1 module" in prompt and "E3 mounting" in prompt
        assert "This is an APPEAL of round 2" in prompt and "CURE" not in prompt
        assert [p["images"] for p in prompts(kind="look", role="leader")] == [2, 2]
        assert claimable(c, INSTALLER) == 0

    def test_an_appeal_that_upholds_a_cured_acceptance_pays_at_once(self, module, c):
        _, mid, first = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        cure(module, c, mid, [fresh], judge_answer({"E2": "INSTALLED"}, basis={"E2": [fresh]}))
        as_(module, OWNER)
        c.open_appeal(mid, "The array is not the specified module.")
        set_now("2026-09-20T10:00:01Z")
        llm(look=look_all(), judge=judge_all(basis={k: first + [fresh] for k in ALL}))
        as_(module, STRANGER)
        assert json.loads(c.decide_appeal(mid))["decision"] == "ACCEPTED"
        c.finalize(mid)
        assert claimable(c, INSTALLER) == 2 * GEN

    def test_a_cured_rejection_is_appealed_by_the_installer(self, module, c):
        _, mid, _ = fell_short(module, c)
        fresh = nameplate(module, c, mid)
        cure(module, c, mid, [fresh], judge_answer({"E2": "ABSENT"}, basis={"E2": [fresh]}))
        as_(module, OWNER)
        with pytest.raises(err(module), match="only the installer appeals a rejection"):
            c.open_appeal(mid, "x")
        as_(module, INSTALLER)
        assert json.loads(c.open_appeal(mid, "The label reads VT-50K."))["against"] == "REJECTED"

    def test_an_appeal_reads_the_chain_the_other_parties_and_its_own_evidence_period(
            self, module, c):
        """From the installer, an appeal reads what the appealed decision
        rests on and what its own evidence period brought: not everything
        left unpresented since. From the owner and the inspector it reads
        everything, whenever filed, as every round does. Evidence filed in
        answer to a rejection is not lost because the installer appealed
        instead of curing."""
        _, mid, first = fell_short(module, c)
        unused = [image(module, c, mid, caption=f"Unused {i}") for i in range(6)]
        theirs = [image(module, c, mid, who=OWNER, req="", caption=f"The wall, view {i}")
                  for i in range(3)]
        as_(module, INSTALLER)
        c.open_appeal(mid, "The wall is the right wall.")
        assert milestone(c, mid)["appeal"]["item_mark"] == 11
        as_(module, OWNER)
        with pytest.raises(err(module), match="you have filed the 3 images"):
            c.submit_image(mid, "{}", b"\xff\xd8\xff\xe0again")
        late = [image(module, c, mid, caption=f"For the appeal {i}") for i in range(2)]
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="at most 2 new images from each party"):
            c.submit_image(mid, "{}", b"\xff\xd8\xff\xe0third")
        set_now("2026-09-20T10:00:01Z")
        reset_prompts()
        llm(look=look_all(), judge=judge_answer(
            {"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"}, {"C1": "MET"},
            basis={k: first for k in ALL}))
        as_(module, STRANGER)
        out = json.loads(c.decide_appeal(mid))
        assert out["new_items"] == theirs + late
        read = [row["item_id"] for row in rounds(c, mid, 2)["evidence"]]
        assert read == first + theirs + late
        assert not set(unused) & set(read)
        assert sum(p["images"] for p in prompts(kind="look", role="leader")) == 7

class TestWithASubstitute:
    PAGE = "https://www.solvanta-power.com/products/sv-50h"

    def agreed(self, module, c, mid, line="E2", **over):
        p = {"manufacturer": "Solvanta", "model": "SV-50H", "rating": "50 kW",
             "page": self.PAGE, "reason": "The specified unit is no longer made."}
        p.update(over)
        as_(module, INSTALLER)
        c.propose_substitution(mid, line, json.dumps(p))
        as_(module, OWNER)
        c.answer_substitution(mid, True, "")

    def test_rejected_substituted_cured_accepted(self, module, c):
        """The whole story: a different inverter is on the wall, the owner
        agrees to it, and a cure round judges that line against it."""
        _, mid, _ = fell_short(module, c)
        self.agreed(module, c, mid)
        fresh = nameplate(module, c, mid)
        reset_prompts()
        out = cure(module, c, mid, [fresh], judge_answer(
            {"E2": "INSTALLED"}, {"C1": "MET"}, basis={"E2": [fresh], "C1": [fresh]}))
        assert out["decision"] == "ACCEPTED"
        assert out["carried"] == {"from_round": 1, "lines": ["E1", "E3"], "criteria": []}, \
            "what was true of the old equipment is judged again with the new"
        prompt = prompts(kind="judge", role="leader")[0]["prompt"]
        assert ("E2 inverter: a substitute in force for this line, named by the installer as "
                "<<<BEGIN NAME Solvanta SV-50H, 50 kW END NAME>>>") in prompt
        assert "VT-50K" not in prompt
        record = rounds(c, mid, 2)
        assert record["schedule"][1]["model"] == "SV-50H"
        assert rounds(c, mid, 1)["schedule"][1]["model"] == "VT-50K", \
            "each round records the schedule it judged against"

    def test_a_line_substituted_since_the_decision_is_judged_again(self, module, c):
        _, mid, _ = fell_short(module, c)
        self.agreed(module, c, mid, line="E3", manufacturer="Kestrel", model="KM-40 Flat",
                    rating="")
        fresh = nameplate(module, c, mid)
        reset_prompts()
        out = cure(module, c, mid, [fresh], judge_answer(
            {"E2": "INSTALLED", "E3": "NOT_SHOWN"}, {"C1": "MET"},
            basis={"E2": [fresh], "E3": [fresh], "C1": [fresh]}))
        assert out["decision"] == "UNDETERMINED"
        assert out["carried"] == {"from_round": 1, "lines": ["E1"], "criteria": []}, \
            "the mounting was found installed as Ridgeline; as Kestrel it is an open question"
        schedule = prompts(kind="judge", role="leader")[0]["prompt"].split("ACCEPTANCE", 1)[0]
        assert "named by the installer as <<<BEGIN NAME Kestrel KM-40 Flat END NAME>>>" in schedule and "E2 inverter" in schedule

    def test_a_line_is_reopened_by_the_substitution_not_by_how_the_product_is_spelled(
            self, module, c):
        """Round one judges E3 as Kestrel. E3 then becomes Kestrel again by a
        second substitution, at a rating that reads the same once the point
        is dropped. It is a different agreement, so the line is open."""
        pid, mid = active_milestone(module, c)
        self.agreed(module, c, mid, line="E3", manufacturer="Kestrel", model="KM-5.0", rating="")
        a = image(module, c, mid, caption="The array", line="E1")
        b = image(module, c, mid, caption="The wall", line="E2")
        assess(module, c, mid, [a, b], judge=judge_answer(
            {"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"}, {"C1": "MET"},
            basis={k: [a, b] for k in ALL}))
        self.agreed(module, c, mid, line="E3", manufacturer="Kestrel", model="KM-50", rating="")
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [fresh], judge_answer(
            {"E2": "INSTALLED", "E3": "INSTALLED"}, {"C1": "MET"},
            basis={k: [fresh] for k in ALL}))
        assert out["carried"]["lines"] == ["E1"]

    def test_a_substitute_proposed_and_taken_back_reopens_nothing(self, module, c):
        _, mid, _ = fell_short(module, c)
        as_(module, INSTALLER)
        c.propose_substitution(mid, "E3", json.dumps(
            {"manufacturer": "Kestrel", "model": "KM-40 Flat", "page": self.PAGE,
             "reason": "Supply."}))
        c.withdraw_substitution(mid)
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [fresh], judge_answer({"E2": "INSTALLED"},
                                                        basis={"E2": [fresh]}))
        assert out["carried"]["lines"] == ["E1", "E3"]

    def test_a_decision_about_another_schedule_is_cured_not_appealed(self, module, c):
        """An appeal says the panel judged wrongly, and its acceptance is
        final. A panel that rejected the old product did not judge the new
        one, so the installer goes by the cure round, whose acceptance the
        owner can still contest."""
        _, mid, first = fell_short(module, c)
        self.agreed(module, c, mid)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="a substitute has come into force since"):
            c.open_appeal(mid, "The unit on the wall is the one now agreed.")
        assert milestone(c, mid)["state"] == "REJECTED"
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [fresh], judge_answer(
            {"E2": "INSTALLED"}, {"C1": "MET"}, basis={"E2": [fresh], "C1": [fresh]}))
        assert out["decision"] == "ACCEPTED"
        assert milestone(c, mid)["standing"]["appealable"] is True

    def test_a_substitute_that_did_not_come_into_force_bars_no_appeal(self, module, c):
        _, mid, _ = fell_short(module, c)
        as_(module, INSTALLER)
        c.propose_substitution(mid, "E2", json.dumps(
            {"manufacturer": "Solvanta", "model": "SV-50H", "rating": "50 kW", "page": self.PAGE,
             "reason": "Supply."}))
        as_(module, OWNER)
        c.answer_substitution(mid, False, "We signed for the Volterra unit.")
        as_(module, INSTALLER)
        assert json.loads(c.open_appeal(mid, "The wall is the right wall."))["against"] == "REJECTED"

    def test_a_late_yes_never_leaves_the_installer_with_nowhere_to_go(self, module, c):
        """The owner sits on a proposal and agrees in the last second of the
        cure period. The appeal is gone, because the decision was about
        another schedule. So the yes itself opens a window to cure."""
        set_now("2026-10-20T11:59:00Z")
        _, mid, _ = fell_short(module, c)                    # deadline 12:00, cure until 12:59
        assert milestone(c, mid)["cure_until"] == "2026-10-20T12:59:00Z"
        set_now("2026-10-20T12:09:00Z")
        as_(module, INSTALLER)
        c.propose_substitution(mid, "E2", json.dumps(
            {"manufacturer": "Solvanta", "model": "SV-50H", "rating": "50 kW", "page": self.PAGE,
             "reason": "The specified unit is no longer made."}))
        set_now("2026-10-20T12:58:59Z")
        as_(module, OWNER)
        assert json.loads(c.answer_substitution(mid, True, ""))["status"] == "AGREED"
        assert milestone(c, mid)["cure_until"] == "2026-10-20T13:58:59Z"
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="a substitute has come into force since"):
            c.open_appeal(mid, "The unit on the wall is the one now agreed.")
        set_now("2026-10-20T13:30:00Z")
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [fresh], judge_answer(
            {"E2": "INSTALLED"}, {"C1": "MET"}, basis={"E2": [fresh], "C1": [fresh]}))
        assert out["decision"] == "ACCEPTED"

    def test_a_late_yes_over_a_decision_in_conflict_leaves_a_cure_too(self, module, c):
        """The rejection also rated a line contradicted, so nothing in it is
        settled. It can still be cured, with nothing kept, so the yes still
        opens a window."""
        set_now("2026-10-20T11:30:00Z")
        _, mid, first = fell_short(module, c, lines={"E3": "CONTRADICTED"})
        m = milestone(c, mid)
        assert m["state"] == "REJECTED" and m["cure_until"] == "2026-10-20T12:30:00Z"
        as_(module, INSTALLER)
        c.propose_substitution(mid, "E2", json.dumps(
            {"manufacturer": "Solvanta", "model": "SV-50H", "rating": "50 kW", "page": self.PAGE,
             "reason": "The specified unit is no longer made."}))
        set_now("2026-10-20T12:29:59Z")
        as_(module, OWNER)
        c.answer_substitution(mid, True, "")
        assert milestone(c, mid)["cure_until"] == "2026-10-20T13:29:59Z"
        set_now("2026-10-20T13:00:00Z")
        fresh = nameplate(module, c, mid)
        out = cure(module, c, mid, [first[0], fresh], judge_all(basis={k: [fresh] for k in ALL}))
        assert out["decision"] == "ACCEPTED" and out["carried"]["lines"] == []

    def test_substitutes_never_push_the_end_of_the_work_more_than_one_window(self, module, c):
        """Two substitutes, each as late as it can be made. The period ends
        at most one window after it first would have."""
        set_now("2026-10-20T11:59:00Z")
        _, mid, _ = fell_short(module, c)                    # cure until 12:59
        set_now("2026-10-20T12:30:00Z")
        self.agreed(module, c, mid)
        assert milestone(c, mid)["cure_until"] == "2026-10-20T13:30:00Z"
        set_now("2026-10-20T12:59:00Z")
        self.agreed(module, c, mid, manufacturer="Volterra", model="VT-50K")
        m = milestone(c, mid)
        assert m["cure_until"] == "2026-10-20T13:59:00Z" and m["cure_base"] == "2026-10-20T12:59:00Z"

    def test_no_second_substitute_is_proposed_inside_the_window_the_first_added(self, module, c):
        """The first substitute pushed the end of the work one window, and
        it goes no further. A second proposal made inside that window could
        be agreed in its last second, taking the appeal and leaving no time
        to cure. So it is not taken at all."""
        set_now("2026-10-20T11:59:00Z")
        _, mid, _ = fell_short(module, c)                    # cure until 12:59
        set_now("2026-10-20T12:58:00Z")
        self.agreed(module, c, mid)                          # now until 13:58
        set_now("2026-10-20T12:59:00Z")
        self.agreed(module, c, mid, manufacturer="Volterra", model="VT-50K")
        assert milestone(c, mid)["cure_until"] == "2026-10-20T13:59:00Z", \
            "at the first end itself a proposal is still taken, and has its window"
        set_now("2026-10-20T12:59:01Z")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="cannot be extended again"):
            c.propose_substitution(mid, "E2", json.dumps(
                {"manufacturer": "Solvanta", "model": "SV-50H", "rating": "50 kW",
                 "page": self.PAGE, "reason": "Supply."}))

    def test_a_substitute_long_before_the_period_ends_bars_no_later_one(self, module, c):
        _, mid, _ = fell_short(module, c)                    # cure until the deadline, a month off
        self.agreed(module, c, mid)
        self.agreed(module, c, mid, manufacturer="Volterra", model="VT-50K")
        assert [s["status"] for s in milestone(c, mid)["substitutions"]] == ["AGREED", "AGREED"]

    def test_a_substitute_in_force_never_shortens_a_cure_period(self, module, c):
        _, mid, _ = fell_short(module, c)                    # cure until the deadline, a month off
        self.agreed(module, c, mid)
        assert milestone(c, mid)["cure_until"] == "2026-10-20T12:00:00Z"

    def test_a_substitute_settled_too_late_to_be_heard_changes_nothing(self, module, c):
        """Agreed after the last moment any round could judge it. The line is
        left alone, and so is the installer's appeal of the standing
        decision, which was about the schedule that still stands."""
        set_now("2026-10-20T11:59:00Z")
        _, mid, first = fell_short(module, c)
        set_now("2026-10-20T12:50:00Z")
        fresh = nameplate(module, c, mid)
        cure(module, c, mid, [fresh], judge_answer({"E2": "ABSENT"}, basis={"E2": [fresh]}))
        set_now("2026-10-20T12:55:00Z")                      # cure period ends 12:59
        as_(module, INSTALLER)
        c.propose_substitution(mid, "E2", json.dumps(
            {"manufacturer": "Solvanta", "model": "SV-50H", "rating": "50 kW", "page": self.PAGE,
             "reason": "The specified unit is no longer made."}))
        set_now("2026-10-20T13:30:00Z")
        as_(module, OWNER)
        out = json.loads(c.answer_substitution(mid, True, ""))
        assert out["status"] == "LAPSED"
        m = milestone(c, mid)
        assert m["schedule"][1]["model"] == "VT-50K" and "substitution" not in m["schedule"][1]
        assert "after the time for work" in m["substitutions"][0]["void_reason"]
        assert m["cure_until"] == "2026-10-20T12:59:00Z"
        as_(module, INSTALLER)
        assert json.loads(c.open_appeal(mid, "The label reads VT-50K."))["against"] == "REJECTED"

    def test_no_substitute_is_proposed_when_no_round_is_left_to_judge_it(self, module, c):
        _, mid, first = fell_short(module, c)
        for _ in range(4):
            assess(module, c, mid, first, judge=judge_answer(
                {"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"}, {"C1": "MET"},
                basis={k: first for k in ALL}))
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="no round left to judge a substitute"):
            c.propose_substitution(mid, "E2", json.dumps(
                {"manufacturer": "Solvanta", "model": "SV-50H", "rating": "50 kW",
                 "page": self.PAGE, "reason": "Supply."}))

