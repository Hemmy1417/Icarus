"""An image nobody can decode, and what a round stores.

Two things are held here. A file the owner or the inspector filed that a
node cannot read is set aside by that node, so it can never stop a round
from being decided; what the installer presents must still reach a node for
it to vote. And nothing a node sends is stored as it came: the findings are
checked and the account beside them is rebuilt field by field."""
import json

import pytest

from conftest import (  # noqa: F401
    GEN, INSPECTOR, INSTALLER, JFIF_TAIL, OWNER, PNG_HEAD, PNG_TAIL, STRANGER, active_milestone,
    as_, assess, document, err, forge_leader, image, jfif, judge_all, judge_answer, llm, look_all,
    look_answer, milestone, network_accepts, png, prints, prompts, rounds, set_now,
)

ALL = ("E1", "E2", "E3", "C1")
UNREAD = look_answer([{}], received=False)


def three(module, c, who=OWNER, **kw):
    """Two photographs from the installer and one from another party. The
    other party's is read first, in a prompt of its own."""
    _, mid = active_milestone(module, c, **kw)
    a = image(module, c, mid, caption="The array", line="E1")
    b = image(module, c, mid, caption="The inverter", line="E2", origin="NAMEPLATE")
    other = image(module, c, mid, who=who, req="", caption="A file from the other side")
    return mid, a, b, other


class TestAnImageNobodyCanRead:
    @pytest.mark.parametrize("who", [OWNER, INSPECTOR])
    def test_it_is_set_aside_and_the_round_is_decided_on_the_rest(self, module, c, who):
        mid, a, b, other = three(module, c, who=who,
                                 inspector=INSPECTOR if who == INSPECTOR else "")
        out = assess(module, c, mid, [a, b], look=[UNREAD, look_all()],
                     judge=judge_all(basis={k: [a, b] for k in ALL}))
        assert out["decision"] == "ACCEPTED"
        record = rounds(c, mid, 1)
        assert record["unread"] == [other]
        assert [(row["item_id"], row["read"]) for row in record["evidence"]] == \
            [(a, True), (b, True), (other, False)]
        assert [x["readable"] for x in record["notes"]["images"]] == [True, True, False]
        told = prompts(kind="judge", role="leader")[0]["prompt"]
        assert f"- {other} (filed by the {'owner' if who == OWNER else 'inspector'}): " \
               "could not be processed; it shows nothing either way" in told

    def test_what_the_installer_presents_must_still_reach_a_node(self, module, c):
        mid, a, b, other = three(module, c)
        with pytest.raises(err(module), match="did not agree"):
            assess(module, c, mid, [a, b],
                   look=[look_all(n_images=1), look_answer([{}, {}], received=False)],
                   judge=judge_all(basis={k: [other] for k in ALL}))
        assert any("the leader did not receive the images" in p for p in prints())
        assert milestone(c, mid)["rounds_count"] == 0

    def test_one_unread_installer_image_is_enough_to_blind_a_node(self, module, c):
        mid, a, b, other = three(module, c)
        half = {"images": [{"n": 1, "readable": True, "shows": "An array."},
                           {"n": 2, "readable": False, "shows": ""}]}
        with pytest.raises(err(module), match="did not agree"):
            assess(module, c, mid, [a, b], look=[look_all(n_images=1), half],
                   judge=judge_all(basis={k: [a] for k in ALL}))

    def test_nothing_is_found_on_an_image_the_node_could_not_read(self, module, c):
        """The node says the line is absent and cites the file it could not
        open. Code does not take a finding from evidence nobody saw."""
        mid, a, b, other = three(module, c)
        out = assess(module, c, mid, [a, b], look=[UNREAD, look_all()], judge=judge_answer(
            {"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"}, {"C1": "NOT_MET"},
            basis={"E1": [a], "E2": [other], "E3": [a], "C1": [other]}))
        assert out["decision"] == "UNDETERMINED"
        assert out["lines"]["E2"] == "NOT_SHOWN" and out["criteria"]["C1"] == "UNCLEAR"

    def test_nothing_is_established_on_it_either(self, module, c):
        mid, a, b, other = three(module, c)
        out = assess(module, c, mid, [a, b], look=[UNREAD, look_all()], judge=judge_answer(
            {"E1": "INSTALLED", "E2": "INSTALLED", "E3": "INSTALLED"}, {"C1": "MET"},
            basis={"E1": [a], "E2": [other], "E3": [a], "C1": [a]}))
        assert out["decision"] == "UNDETERMINED" and out["lines"]["E2"] == "NOT_SHOWN"

    def test_a_leader_that_could_not_read_it_is_confirmed_by_one_that_found_nothing_in_it(
            self, module, c):
        mid, a, b, other = three(module, c)
        out = assess(module, c, mid, [a, b], look=[UNREAD, look_all()],
                     judge=judge_all(basis={k: [a, b] for k in ALL}),
                     v_look=[look_all(n_images=1), look_all()],
                     v_judge=judge_all(basis={k: [a, b] for k in ALL}))
        assert out["decision"] == "ACCEPTED"
        assert rounds(c, mid, 1)["unread"] == [other], "the record is the leader's reading"

    def test_a_leader_cannot_ignore_evidence_a_validator_can_read(self, module, c):
        """The leader says it could not open the owner's photograph and
        accepts. A validator that opened it and found the inverter missing
        does not confirm that."""
        mid, a, b, other = three(module, c)
        with pytest.raises(err(module), match="did not agree"):
            assess(module, c, mid, [a, b], look=[UNREAD, look_all()],
                   judge=judge_all(basis={k: [a, b] for k in ALL}),
                   v_look=[look_all(n_images=1), look_all()],
                   v_judge=judge_answer({"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"},
                                        {"C1": "MET"},
                                        basis={"E1": [a], "E2": [other], "E3": [a], "C1": [a]}))
        assert any("the leader accepts; this node finds rejected" in p for p in prints())

    def test_a_rejection_on_an_image_a_validator_could_not_read_is_not_confirmed(self, module, c):
        mid, a, b, other = three(module, c)
        rejecting = judge_answer({"E1": "INSTALLED", "E2": "ABSENT", "E3": "INSTALLED"},
                                 {"C1": "MET"},
                                 basis={"E1": [a], "E2": [other], "E3": [a], "C1": [a]})
        with pytest.raises(err(module), match="did not agree"):
            assess(module, c, mid, [a, b], look=[look_all(n_images=1), look_all()],
                   judge=rejecting, v_look=[UNREAD, look_all()], v_judge=rejecting)
        assert any("line E2: the leader finds it absent, this node finds it not_shown" in p
                   for p in prints())

    def test_an_image_from_another_party_never_shares_a_prompt(self, module, c):
        """Three photographs from the installer and two from the inspector.
        Read two at a time in filing order, the installer's third would
        travel with the inspector's first."""
        _, mid = active_milestone(module, c, inspector=INSPECTOR)
        mine = [image(module, c, mid, caption=f"View {n}", line="E1") for n in (1, 2, 3)]
        theirs = [image(module, c, mid, who=INSPECTOR, req="", caption=f"Visit {n}")
                  for n in (1, 2)]
        out = assess(module, c, mid, mine,
                     look=[look_all(n_images=1), look_all(n_images=1), look_all(),
                           look_all(n_images=1)],
                     judge=judge_all(basis={k: mine for k in ALL}))
        assert out["decision"] == "ACCEPTED"
        asked = prompts(kind="look", role="leader")
        assert [p["images"] for p in asked] == [1, 1, 2, 1], "and they are asked first"
        assert [x["item_id"] for x in rounds(c, mid, 1)["notes"]["images"]] == mine + theirs

    @pytest.mark.parametrize("who", [OWNER, INSPECTOR])
    def test_a_file_that_fails_its_prompt_fails_only_itself(self, module, c, who):
        """The runtime refuses to pass the file to a model at all, on both
        attempts. That is an image nobody could read, not a failed round."""
        mid, a, b, other = three(module, c, who=who,
                                 inspector=INSPECTOR if who == INSPECTOR else "")
        out = assess(module, c, mid, [a, b],
                     look=[RuntimeError("INVALID_IMAGE"), RuntimeError("INVALID_IMAGE"),
                           look_all()],
                     judge=judge_all(basis={k: [a, b] for k in ALL}))
        assert out["decision"] == "ACCEPTED"
        record = rounds(c, mid, 1)
        assert record["unread"] == [other]
        assert [x["readable"] for x in record["notes"]["images"]] == [True, True, False]
        assert [p["images"] for p in prompts(kind="look", role="leader")] == [1, 1, 2], \
            "the file was tried twice before it was set aside"

    def test_a_prompt_that_fails_on_what_the_installer_presents_decides_nothing(self, module, c):
        mid, a, b, other = three(module, c)
        with pytest.raises(err(module), match="did not agree"):
            assess(module, c, mid, [a, b],
                   look=[look_all(n_images=1), RuntimeError("INVALID_IMAGE")],
                   judge=judge_all(basis={k: [other] for k in ALL}))
        assert any("the leader did not receive the images" in p for p in prints())
        assert milestone(c, mid)["rounds_count"] == 0

    @pytest.mark.parametrize("garbled", [
        {"n": 1, "readable": True, "shows": "An empty inverter bay."},
        {"images": {"n": 1, "readable": True, "shows": "An empty inverter bay."}},
        {"images": [{"readable": True, "shows": "An empty inverter bay."}]},
        {"image": [{"n": 1, "readable": True, "shows": "An empty inverter bay."}]},
        {"images": [{"n": 1, "shows": ""}]},
        {"images": [{"n": 1, "readable": 0, "shows": ""}]},
        {"images": [{"n": 1, "readable": "false", "shows": ""}]},
        {"images": [{"n": "one", "readable": True, "shows": "An empty inverter bay."}]},
        {"images": 5},
        {},
    ])
    def test_a_garbled_answer_is_the_nodes_failure_not_the_files(self, module, c, garbled):
        """Only a node that says in so many words that it could not read the
        image sets it aside. One whose answer about a legible photograph came
        back in the wrong shape has not read the evidence, and does not vote."""
        mid, a, b, other = three(module, c)
        with pytest.raises(err(module), match="did not agree"):
            assess(module, c, mid, [a, b], look=[garbled, look_all()],
                   judge=judge_all(basis={k: [a, b] for k in ALL}))
        assert any("the leader did not receive the images" in p for p in prints())
        assert milestone(c, mid)["rounds_count"] == 0

    @pytest.mark.parametrize("answer", [
        [{"n": 1, "readable": True, "shows": "An empty inverter bay."}],
        "I am sorry, I cannot describe this image.",
        5,
        None,
    ])
    def test_an_answer_that_is_no_object_is_the_nodes_failure_too(self, module, c, answer):
        """The runtime ran the prompt both times and something came back.
        That is not a file nobody could read, whatever shape it came in."""
        mid, a, b, other = three(module, c)
        with pytest.raises(err(module), match="did not agree"):
            assess(module, c, mid, [a, b], look=[answer, answer, look_all()],
                   judge=judge_all(basis={k: [a, b] for k in ALL}))
        assert any("the leader did not receive the images" in p for p in prints())
        assert [p["images"] for p in prompts(kind="look", role="leader")] == [1, 1, 2]

    def test_one_refusal_by_the_runtime_is_not_two(self, module, c):
        """Refused once, then answered with something unusable: the node
        failed, the file did not."""
        mid, a, b, other = three(module, c)
        with pytest.raises(err(module), match="did not agree"):
            assess(module, c, mid, [a, b],
                   look=[RuntimeError("INVALID_IMAGE"), "not an object", look_all()],
                   judge=judge_all(basis={k: [a, b] for k in ALL}))
        assert milestone(c, mid)["rounds_count"] == 0

    def test_a_prompt_refused_once_and_then_answered_is_read(self, module, c):
        mid, a, b, other = three(module, c)
        out = assess(module, c, mid, [a, b],
                     look=[RuntimeError("TIMEOUT"), look_all(n_images=1), look_all()],
                     judge=judge_all(basis={k: [a, b] for k in ALL}))
        assert out["decision"] == "ACCEPTED" and rounds(c, mid, 1)["unread"] == []

    @pytest.mark.parametrize("row", [
        {"n": 1, "readable": "false", "shows": "No image reached me."},
        {"n": 1, "readable": "true", "shows": "An array."},
        {"n": 1, "readable": 1, "shows": "An array."},
        {"n": 1, "readable": True, "shows": "   \n "},
    ])
    def test_a_node_reads_only_when_it_says_so_plainly(self, module, c, row):
        """Readable is the boolean true and a description with something in
        it. A word that happens to be truthy is not a sighting."""
        _, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="The array", line="E1")
        b = image(module, c, mid, caption="The inverter", line="E2")
        good = {"n": 2, "readable": True, "shows": "An inverter on a wall."}
        with pytest.raises(err(module), match="did not agree"):
            assess(module, c, mid, [a, b], look={"images": [row, good]},
                   judge=judge_all(basis={k: [a, b] for k in ALL}))
        assert any("the leader did not receive the images" in p for p in prints())

    @pytest.mark.parametrize("row", [
        {"n": "1", "readable": True, "shows": "A wall.", "labels": 5, "concerns": "none"},
        {"n": 1, "readable": True, "shows": "A wall.", "labels": {"a": 1}, "concerns": 7},
    ])
    def test_an_odd_but_usable_answer_is_read_for_what_it_holds(self, module, c, row):
        mid, a, b, other = three(module, c)
        out = assess(module, c, mid, [a, b], look=[{"images": [row]}, look_all()],
                     judge=judge_all(basis={k: [a, b] for k in ALL}))
        assert out["decision"] == "ACCEPTED"
        seen = rounds(c, mid, 1)["notes"]["images"][2]
        assert seen["readable"] is True and seen["labels"] == [] and seen["concerns"] == []

    def test_the_stall_is_gone_end_to_end(self, module, c):
        """The owner appeals an acceptance and files a file no node can
        open. The appeal is decided on everything else, and the acceptance
        it upholds pays."""
        _, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="The array", line="E1")
        b = image(module, c, mid, caption="The inverter", line="E2")
        assess(module, c, mid, [a, b], judge=judge_all(basis={k: [a, b] for k in ALL}))
        as_(module, OWNER)
        c.open_appeal(mid, "The inverter is not the one specified.")
        junk = image(module, c, mid, who=OWNER, req="", caption="Proof")
        set_now("2026-09-20T10:00:01Z")
        llm(look=[UNREAD, look_all()], judge=judge_all(basis={k: [a, b] for k in ALL}))
        as_(module, STRANGER)
        assert json.loads(c.decide_appeal(mid))["decision"] == "ACCEPTED"
        assert rounds(c, mid, 2)["unread"] == [junk]
        assert json.loads(c.finalize(mid))["credited_wei"] == str(2 * GEN)


class TestWhatCountsAsAnImageFile:
    def test_a_whole_png_and_a_whole_jpeg_are_taken(self, module, c):
        _, mid = active_milestone(module, c)
        as_(module, INSTALLER)
        for data in (png(b"x"), jfif(b"x"), jfif(b"x").replace(b"\xff\xc0", b"\xff\xc2"),
                     PNG_HEAD + PNG_TAIL):
            assert json.loads(c.submit_image(mid, "{}", data))["item_id"]

    @pytest.mark.parametrize("data,why", [
        (b"\x89PNG\r\n\x1a\n" + b"\x00" * 60, "PNG is incomplete"),
        (b"\x89PNG" + b"\x00" * 60 + PNG_TAIL, "PNG and JFIF JPEG only"),
        (PNG_HEAD + b"\x00" * 60, "PNG is incomplete"),
        (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIDAT" + b"\x00" * 60 + PNG_TAIL, "PNG is incomplete"),
        (PNG_HEAD + b"\x00" * 60 + PNG_TAIL + b"\x00", "PNG is incomplete"),
        (b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 60, "JPEG is incomplete"),
        (b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 60 + b"\xff\xda\xff\xd9", "JPEG is incomplete"),
        (b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 60 + b"\xff\xc0\xff\xd9", "JPEG is incomplete"),
        (b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 60 + b"\xff\xc0\xff\xda", "JPEG is incomplete"),
        (b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + JFIF_TAIL + b"\x00", "JPEG is incomplete"),
        (b"\xff\xd8\xff\xe0\x00\x10JFXX\x00" + b"\x00" * 60 + JFIF_TAIL, "PNG and JFIF JPEG only"),
        (b"\xff\xd8\xff\xe1\x00\x10Exif\x00" + b"\x00" * 60 + JFIF_TAIL, "PNG and JFIF JPEG only"),
        (b"GIF89a" + b"\x00" * 60, "PNG and JFIF JPEG only"),
        (b"\xff\xd8", "PNG and JFIF JPEG only"),
    ])
    def test_a_file_not_built_like_an_image_is_refused(self, module, c, data, why):
        _, mid = active_milestone(module, c)
        as_(module, OWNER)
        with pytest.raises(err(module), match=why):
            c.submit_image(mid, "{}", data)
        assert milestone(c, mid)["evidence"]["1"] == []


class TestWhatARoundStores:
    def forged(self, a, b, **over):
        result = {"images_received": True, "conflicts": False, "unread": [],
                  "lines": {"E1": "INSTALLED", "E2": "INSTALLED", "E3": "INSTALLED"},
                  "criteria": {"C1": "MET"},
                  "notes": {"reasoning": "ok", "conflict_note": "", "lines_raw": {}, "criteria_raw": {},
                            "basis": {}, "criteria_basis": {}, "line_notes": {}, "images": []}}
        result.update(over)
        return result

    def two(self, module, c):
        _, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="The array", line="E1")
        b = image(module, c, mid, caption="The inverter", line="E2")
        llm(look=look_all(), judge=judge_all(basis={k: [a, b] for k in ALL}))
        as_(module, INSTALLER)
        return mid, a, b

    def test_the_account_beside_the_findings_is_rebuilt_and_bounded(self, module, c):
        mid, a, b = self.two(module, c)
        forge_leader(self.forged(a, b, notes={
            "reasoning": "r" * 400_000, "conflict_note": ["not", "text"], "anything": "x" * 100_000,
            "lines_raw": {"E1": "INSTALLED", "E2": "PAID IN FULL", "E9": "INSTALLED"},
            "criteria_raw": "MET",
            "basis": {"E1": [a, "ev-999999", 7, a, b] + [a] * 20, "E2": "all of it"},
            "criteria_basis": {"C1": [b]},
            "line_notes": {"E1": "n" * 5000, "E2": {"deep": 1}},
            "images": [{"item_id": a, "role": "INSPECTOR", "origin": "SCAN", "readable": "yes",
                        "shows": "s" * 100_000, "labels": ["l" * 900] * 40, "concerns": "none",
                        "caption": "forged caption"},
                       {"item_id": "ev-999999", "shows": "an item this round never held"},
                       "not a row"]}))
        out = json.loads(c.request_assessment(mid, json.dumps([a, b])))
        assert out["decision"] == "ACCEPTED"
        n = rounds(c, mid, 1)["notes"]
        assert sorted(n) == ["basis", "conflict_note", "criteria_basis", "criteria_raw", "images",
                             "line_notes", "lines_raw", "reasoning"]
        assert len(n["reasoning"]) == 900 and n["conflict_note"] == ""
        assert n["lines_raw"] == {"E1": "INSTALLED", "E2": "NOT_SHOWN", "E3": "NOT_SHOWN"}
        assert n["criteria_raw"] == {"C1": "UNCLEAR"}
        assert n["basis"] == {"E1": [a, a, b, a, a, a, a, a], "E2": [], "E3": []}
        assert n["criteria_basis"] == {"C1": [b]}
        assert len(n["line_notes"]["E1"]) == 200 and n["line_notes"]["E2"] == ""
        assert [x["item_id"] for x in n["images"]] == [a, b]
        first = n["images"][0]
        assert first["role"] == "INSTALLER" and first["origin"] == "PHOTO", \
            "who filed an item and what it is come from the record, not from a node"
        assert first["caption"] == "The array" and first["readable"] is False
        assert len(first["shows"]) == 2000 and len(first["labels"]) == 8
        assert len(first["labels"][0]) == 200 and first["concerns"] == []
        assert n["images"][1]["shows"] == "" and n["images"][1]["readable"] is False
        assert len(c.rounds[f"{mid}|1"]) < 12_000

    @pytest.mark.parametrize("drop", ["notes", "unread", "conflicts"])
    def test_a_result_with_a_part_missing_is_stored_whole(self, module, c, drop):
        mid, a, b = self.two(module, c)
        result = self.forged(a, b)
        del result[drop]
        forge_leader(result)
        out = json.loads(c.request_assessment(mid, json.dumps([a, b])))
        assert out["decision"] == "ACCEPTED"
        record = rounds(c, mid, 1)
        assert record["unread"] == [] and record["conflicts_detected"] is False
        assert record["notes"]["reasoning"] == ("" if drop == "notes" else "ok")

    def test_a_truthy_conflict_flag_is_a_conflict_before_and_after_the_vote(self, module, c):
        """A validator reads a leader's truthy flag as a conflict. So does
        the contract afterwards: the two must never read one result two
        ways, or a decision could be derived that nobody agreed."""
        mid, a, b = self.two(module, c)
        llm(look=look_all(), judge=judge_all(conflicts=True, basis={k: [a, b] for k in ALL}))
        forge_leader(self.forged(a, b, conflicts="yes"))
        out = json.loads(c.request_assessment(mid, json.dumps([a, b])))
        assert out["decision"] == "UNDETERMINED"
        assert rounds(c, mid, 1)["conflicts_detected"] is True

    def test_only_another_partys_image_this_round_held_is_recorded_as_unread(self, module, c):
        """A node that could not read what the installer presented did not
        vote, so a record saying the installer's image was set aside would
        contradict the decision beside it."""
        mid, a, b, other = three(module, c)
        llm(look=look_all(), judge=judge_all(basis={k: [a, b] for k in ALL}))
        as_(module, INSTALLER)
        said = [{"item_id": x, "readable": True, "shows": "A wall."} for x in (a, b, other)]
        forge_leader(self.forged(a, b, unread=[b, other, "ev-999999", 7, {"x": 1}],
                                 notes={"images": said}))
        c.request_assessment(mid, json.dumps([a, b]))
        record = rounds(c, mid, 1)
        assert record["unread"] == [other]
        assert [(row["item_id"], row["read"]) for row in record["evidence"]] == \
            [(a, True), (b, True), (other, False)]
        assert [x["readable"] for x in record["notes"]["images"]] == [True, True, False], \
            "the account cannot call readable what the record says was set aside"

    def test_the_account_rests_nothing_on_an_image_set_aside(self, module, c):
        mid, a, b, other = three(module, c)
        llm(look=look_all(), judge=judge_all(basis={k: [a, b] for k in ALL}))
        as_(module, INSTALLER)
        forge_leader(self.forged(a, b, unread=[other], notes={
            "basis": {"E1": [a, other], "E2": [other]}, "criteria_basis": {"C1": [other, b]}}))
        c.request_assessment(mid, json.dumps([a, b]))
        notes = rounds(c, mid, 1)["notes"]
        assert notes["basis"] == {"E1": [a], "E2": [], "E3": []}
        assert notes["criteria_basis"] == {"C1": [b]}

    def test_the_account_describes_nothing_it_says_was_set_aside(self, module, c):
        mid, a, b, other = three(module, c)
        llm(look=look_all(), judge=judge_all(basis={k: [a, b] for k in ALL}))
        as_(module, INSTALLER)
        forge_leader(self.forged(a, b, unread=[other], notes={"images": [
            {"item_id": other, "readable": False, "shows": "An empty inverter bay.",
             "labels": ["VT-99X"], "concerns": ["No unit fitted"]}]}))
        c.request_assessment(mid, json.dumps([a, b]))
        seen = rounds(c, mid, 1)["notes"]["images"][2]
        assert (seen["readable"], seen["shows"], seen["labels"], seen["concerns"]) == \
            (False, "", [], [])

    def test_a_validator_reads_sight_as_the_contract_does(self, module, c):
        """One result is never read two ways: a leader whose word for having
        seen the images is not a plain yes is refused by the validator, not
        agreed with and then thrown out."""
        mid, a, b = self.two(module, c)
        forge_leader(self.forged(a, b, images_received=1))
        with pytest.raises(err(module), match="did not agree"):
            c.request_assessment(mid, json.dumps([a, b]))
        assert any("the leader did not receive the images" in p for p in prints())

    @pytest.mark.parametrize("flag", [False, None, 0, "true", 1])
    def test_a_blind_leaders_result_is_never_recorded(self, module, c, flag):
        """A validator refuses a leader that saw nothing. The contract
        checks again, on whatever the network hands back."""
        mid, a, b = self.two(module, c)
        network_accepts(self.forged(a, b, images_received=flag))
        with pytest.raises(err(module), match="no usable result"):
            c.request_assessment(mid, json.dumps([a, b]))
        assert milestone(c, mid)["rounds_count"] == 0

    @pytest.mark.parametrize("accepted", [
        None, "ACCEPTED", [], {"lines": {}}, {"criteria": {}},
        {"lines": "all installed", "criteria": {"C1": "MET"}},
        {"lines": {"E1": "INSTALLED", "E2": "INSTALLED"}, "criteria": {"C1": "MET"}},
        {"lines": {"E1": "INSTALLED", "E2": "INSTALLED", "E3": "FINE"}, "criteria": {"C1": "MET"}},
        {"lines": {"E1": "INSTALLED", "E2": "INSTALLED", "E3": "INSTALLED"}, "criteria": {}},
        {"lines": {"E1": "INSTALLED", "E2": "INSTALLED", "E3": "INSTALLED"},
         "criteria": {"C1": "YES"}},
    ])
    def test_the_contract_checks_what_the_network_hands_back(self, module, c, accepted):
        mid, a, b = self.two(module, c)
        if isinstance(accepted, dict):
            accepted = {"images_received": True, **accepted}
        network_accepts(accepted)
        with pytest.raises(err(module), match="no usable result"):
            c.request_assessment(mid, json.dumps([a, b]))
        assert milestone(c, mid)["rounds_count"] == 0
