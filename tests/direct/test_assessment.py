"""The assessment: what the panel is asked, what code refuses to take from it,
and when a validator may confirm a leader.

The rules under test are the ones that make ICARUS a matching problem rather
than a look-at-the-photo problem: a line is installed only on an image, an
adverse finding needs an observation too, and consensus binds the schedule
line by line."""
import json

import pytest

from conftest import (  # noqa: F401
    GEN, INSPECTOR, INSTALLER, OWNER, STRANGER, active_milestone, as_, assess, document,
    err, forge_leader, image, judge_all, judge_answer, llm, look_all, milestone, prints,
    prompts, rounds,
)


def two_images(module, c, mid):
    return [image(module, c, mid, caption="The array from the north parapet", line="E1"),
            image(module, c, mid, caption="The inverter on the plant room wall", line="E2",
                  origin="NAMEPLATE")]


class TestTheQuestion:
    def test_the_image_prompt_never_names_the_expected_equipment(self, module, c):
        """A node that knows the model number can read it into a blurred label,
        so the reading step is blind to the schedule."""
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        assess(module, c, mid, items)
        looks = [p["prompt"] for p in prompts(kind="look", role="leader")]
        assert looks, "no image prompt ran"
        for prompt in looks:
            assert "HX-550M" not in prompt
            assert "Volterra" not in prompt
            assert "VT-50K" not in prompt
            assert "transcrib" in prompt.lower()

    def test_the_judging_prompt_carries_the_schedule_and_the_documentary_rule(self, module, c):
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        assess(module, c, mid, items)
        judged = [p["prompt"] for p in prompts(kind="judge", role="leader")]
        assert len(judged) == 1
        prompt = judged[0]
        assert "EQUIPMENT SCHEDULE" in prompt
        assert "E1 module: Helion Solar HX-550M" in prompt
        assert "E2 inverter: Volterra VT-50K" in prompt
        assert "nameplate must be legible" in prompt
        assert "never, by itself, evidence that equipment was installed" in prompt

    def test_the_panel_is_never_told_the_payment_or_who_benefits(self, module, c):
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        assess(module, c, mid, items)
        for p in prompts():
            assert "2000000000000000000" not in p["prompt"]
            assert INSTALLER not in p["prompt"]
            assert OWNER not in p["prompt"]

    def test_images_go_two_at_a_time(self, module, c):
        _, mid = active_milestone(module, c)
        items = [image(module, c, mid, caption=f"View {i}") for i in range(4)]
        assess(module, c, mid, items,
               look=[look_all(n_images=2), look_all(n_images=2)])
        assert [p["images"] for p in prompts(kind="look", role="leader")] == [2, 2]


class TestGrounding:
    def test_a_line_is_never_installed_on_documents_alone(self, module, c):
        """A datasheet states what was specified. It cannot witness a roof."""
        _, mid = active_milestone(module, c)
        img = image(module, c, mid, caption="The array", line="E1")
        img2 = image(module, c, mid, caption="The plant room wall", line="E2")
        doc = document(module, c, mid, line="E2", title="Inverter datasheet")
        out = assess(module, c, mid, [img, img2, doc],
                     judge=judge_answer({"E1": "INSTALLED", "E2": "INSTALLED",
                                         "E3": "INSTALLED"},
                                        {"C1": "MET"},
                                        basis={"E1": [img], "E2": [doc], "E3": [img]}))
        assert out["lines"]["E2"] == "NOT_SHOWN", out["lines"]
        assert out["decision"] == "UNDETERMINED"

    def test_an_adverse_finding_needs_an_observation_too(self, module, c):
        """The mirror: the owner's own paperwork cannot reject a line either."""
        _, mid = active_milestone(module, c)
        img = image(module, c, mid, caption="The array", line="E1")
        img2 = image(module, c, mid, caption="The inverter", line="E2", origin="NAMEPLATE")
        theirs = document(module, c, mid, who=OWNER, title="Owner's note",
                          text="We believe the wrong inverter was fitted.")
        out = assess(module, c, mid, [img, img2],
                     judge=judge_answer({"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"},
                                        {"C1": "MET"},
                                        basis={"E1": [img], "E2": [theirs], "E3": [img]}))
        assert out["lines"]["E2"] == "NOT_SHOWN", out["lines"]
        # doubt, never a rejection, on one party's word
        assert out["decision"] == "UNDETERMINED"

    def test_the_inspector_can_ground_an_adverse_finding(self, module, c):
        _, mid = active_milestone(module, c, inspector=INSPECTOR)
        img = image(module, c, mid, caption="The array", line="E1")
        img2 = image(module, c, mid, caption="The inverter", line="E2", origin="NAMEPLATE")
        report = document(module, c, mid, who=INSPECTOR, title="Site inspection",
                          text="No inverter was present at the plant room wall on inspection.")
        out = assess(module, c, mid, [img, img2],
                     judge=judge_answer({"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"},
                                        {"C1": "MET"},
                                        basis={"E1": [img], "E2": [report], "E3": [img]}))
        assert out["lines"]["E2"] == "ABSENT"
        assert out["decision"] == "REJECTED"

    def test_grounding_only_ever_lowers_a_finding(self, module, c):
        """It can turn an acceptance into doubt; it can never turn doubt into
        an acceptance."""
        _, mid = active_milestone(module, c)
        img, img2 = two_images(module, c, mid)
        out = assess(module, c, mid, [img, img2],
                     judge=judge_answer({"E1": "UNIDENTIFIED", "E2": "INSTALLED",
                                         "E3": "INSTALLED"},
                                        {"C1": "MET"},
                                        basis={"E1": [img], "E2": [img2], "E3": [img]}))
        assert out["lines"]["E1"] == "UNIDENTIFIED"
        assert out["decision"] == "UNDETERMINED"


class TestTheDecision:
    def test_every_line_installed_and_criteria_met_accepts(self, module, c):
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        out = assess(module, c, mid, items,
                     judge=judge_answer({"E1": "INSTALLED", "E2": "INSTALLED", "E3": "INSTALLED"},
                                        {"C1": "MET"},
                                        basis={k: [items[0]] for k in ("E1", "E2", "E3", "C1")}))
        assert out["decision"] == "ACCEPTED"
        assert out["quality"] == "SUFFICIENT"
        assert milestone(c, mid)["state"] == "ACCEPTED"

    @pytest.mark.parametrize("status,decision", [
        ("ABSENT", "REJECTED"),
        ("UNIDENTIFIED", "UNDETERMINED"),
        ("NOT_SHOWN", "UNDETERMINED"),
        ("CONTRADICTED", "UNDETERMINED"),
    ])
    def test_one_line_decides_the_milestone(self, module, c, status, decision):
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        out = assess(module, c, mid, items,
                     judge=judge_answer({"E1": "INSTALLED", "E2": status, "E3": "INSTALLED"},
                                        {"C1": "MET"},
                                        basis={k: [items[0], items[1]]
                                               for k in ("E1", "E2", "E3", "C1")}))
        assert out["decision"] == decision, out["lines"]

    def test_a_conflict_never_pays(self, module, c):
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        out = assess(module, c, mid, items,
                     judge=judge_answer({"E1": "INSTALLED", "E2": "INSTALLED", "E3": "INSTALLED"},
                                        {"C1": "MET"}, conflicts=True,
                                        basis={k: [items[0]] for k in ("E1", "E2", "E3", "C1")}))
        assert out["decision"] == "UNDETERMINED"
        assert out["quality"] == "CONFLICTING"

    def test_an_unrated_line_is_doubt_not_agreement(self, module, c):
        """A model that says nothing about a line has not established it."""
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        out = assess(module, c, mid, items,
                     judge=judge_answer({"E1": "INSTALLED", "E2": "INSTALLED"},
                                        {"C1": "MET"},
                                        basis={k: [items[0]] for k in ("E1", "E2", "C1")}))
        assert out["lines"]["E3"] == "NOT_SHOWN"
        assert out["decision"] == "UNDETERMINED"

    def test_the_record_marks_what_the_decision_rested_on(self, module, c):
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        assess(module, c, mid, items,
               judge=judge_answer({"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"},
                                  {"C1": "MET"},
                                  basis={k: [items[0], items[1]]
                                         for k in ("E1", "E2", "E3", "C1")}))
        record = rounds(c, mid, 1)
        assert record["decisive"]["lines"] == ["E2"]
        assert record["decisive"]["criteria"] == []
        assert [row["item_id"] for row in record["evidence"]] == items
        assert all(row["sha256"] for row in record["evidence"])


class TestConsensus:
    def test_an_acceptance_needs_every_line_reproduced(self, module, c):
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        b = {k: [items[0], items[1]] for k in ("E1", "E2", "E3", "C1")}
        with pytest.raises(err(module), match="validators did not agree"):
            assess(module, c, mid, items,
                   judge=judge_answer({"E1": "INSTALLED", "E2": "INSTALLED", "E3": "INSTALLED"},
                                      {"C1": "MET"}, basis=b),
                   v_judge=judge_answer({"E1": "INSTALLED", "E2": "UNIDENTIFIED",
                                         "E3": "INSTALLED"}, {"C1": "MET"}, basis=b))
        assert milestone(c, mid)["rounds_count"] == 0
        assert any("[DISAGREE]" in line and "accepts" in line for line in prints())

    def test_a_rejection_needs_the_absent_line_found_absent_again(self, module, c):
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        b = {k: [items[0], items[1]] for k in ("E1", "E2", "E3", "C1")}
        with pytest.raises(err(module)):
            assess(module, c, mid, items,
                   judge=judge_answer({"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"},
                                      {"C1": "MET"}, basis=b),
                   v_judge=judge_answer({"E1": "ABSENT", "E2": "INSTALLED", "E3": "INSTALLED"},
                                        {"C1": "MET"}, basis=b))
        assert any("E2" in line for line in prints() if "[DISAGREE]" in line)

    def test_a_leader_cannot_withhold_an_acceptance_a_validator_would_grant(self, module, c):
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        b = {k: [items[0], items[1]] for k in ("E1", "E2", "E3", "C1")}
        with pytest.raises(err(module)):
            assess(module, c, mid, items,
                   judge=judge_answer({"E1": "INSTALLED", "E2": "UNIDENTIFIED",
                                       "E3": "INSTALLED"}, {"C1": "MET"}, basis=b),
                   v_judge=judge_answer({"E1": "INSTALLED", "E2": "INSTALLED",
                                         "E3": "INSTALLED"}, {"C1": "MET"}, basis=b))
        assert any("withholds" in line for line in prints() if "[DISAGREE]" in line)

    def test_a_reading_that_decides_nothing_may_differ(self, module, c):
        """Both nodes reject on E2; they may disagree about a line that did
        not decide anything."""
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        b = {k: [items[0], items[1]] for k in ("E1", "E2", "E3", "C1")}
        out = assess(module, c, mid, items,
                     judge=judge_answer({"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"},
                                        {"C1": "MET"}, basis=b),
                     v_judge=judge_answer({"E1": "UNIDENTIFIED", "E2": "ABSENT",
                                           "E3": "INSTALLED"}, {"C1": "MET"}, basis=b))
        assert out["decision"] == "REJECTED"

    def test_a_forged_leader_result_is_refused(self, module, c):
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        with pytest.raises(err(module)):
            llm(look=look_all(), judge=judge_all())
            as_(module, INSTALLER)
            forge_leader({"lines": "not a dict"})
            c.request_assessment(mid, json.dumps(items))
        assert milestone(c, mid)["rounds_count"] == 0

    def test_a_blind_validator_disagrees_rather_than_deciding(self, module, c):
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        with pytest.raises(err(module)):
            assess(module, c, mid, items,
                   v_look=look_all(received=False))
        assert any("did not receive the images" in line for line in prints())

    def test_a_validator_whose_own_reading_fails_disagrees_in_words(self, module, c):
        _, mid = active_milestone(module, c)
        items = two_images(module, c, mid)
        with pytest.raises(err(module)):
            assess(module, c, mid, items, v_judge=RuntimeError("model unavailable"))
        assert any("could not judge the evidence" in line for line in prints())


class TestCriteriaAreGroundedToo:
    def test_a_criterion_is_never_met_on_a_party_document_alone(self, module, c):
        """Otherwise terms written as criteria rather than as a schedule would
        be a way around the floor."""
        _, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="The array", line="E1")
        b = image(module, c, mid, caption="The inverter", line="E2", origin="NAMEPLATE")
        theirs = document(module, c, mid, title="Commissioning report",
                          text="We commissioned the system and it performs to specification.")
        out = assess(module, c, mid, [a, b, theirs],
                     judge=judge_answer({"E1": "INSTALLED", "E2": "INSTALLED", "E3": "INSTALLED"},
                                        {"C1": "MET"},
                                        basis={"E1": [a], "E2": [b], "E3": [a],
                                               "C1": [theirs]}))
        assert out["criteria"]["C1"] == "UNCLEAR"
        assert out["decision"] == "UNDETERMINED"

    def test_the_inspector_can_establish_a_criterion(self, module, c):
        _, mid = active_milestone(module, c, inspector=INSPECTOR)
        a = image(module, c, mid, caption="The array", line="E1")
        b = image(module, c, mid, caption="The inverter", line="E2", origin="NAMEPLATE")
        report = document(module, c, mid, who=INSPECTOR, title="Site inspection",
                          text="The array follows the approved layout and orientation.")
        out = assess(module, c, mid, [a, b],
                     judge=judge_answer({"E1": "INSTALLED", "E2": "INSTALLED", "E3": "INSTALLED"},
                                        {"C1": "MET"},
                                        basis={"E1": [a], "E2": [b], "E3": [a],
                                               "C1": [report]}))
        assert out["criteria"]["C1"] == "MET"
        assert out["decision"] == "ACCEPTED"

    def test_an_ungrounded_rejection_of_a_criterion_falls_to_doubt_as_well(self, module, c):
        _, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="The array", line="E1")
        b = image(module, c, mid, caption="The inverter", line="E2", origin="NAMEPLATE")
        theirs = document(module, c, mid, who=OWNER, title="Owner's note",
                          text="The orientation looks wrong to us.")
        out = assess(module, c, mid, [a, b],
                     judge=judge_answer({"E1": "INSTALLED", "E2": "INSTALLED", "E3": "INSTALLED"},
                                        {"C1": "NOT_MET"},
                                        basis={"E1": [a], "E2": [b], "E3": [a],
                                               "C1": [theirs]}))
        assert out["criteria"]["C1"] == "UNCLEAR"
        assert out["decision"] == "UNDETERMINED", "doubt, never a rejection, on one party's word"
