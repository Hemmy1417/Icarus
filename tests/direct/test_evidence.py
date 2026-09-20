"""Evidence: who may file, what the contract stores, and what it refuses."""
import json

import pytest

from conftest import (  # noqa: F401
    GEN, INSPECTOR, INSTALLER, OWNER, STRANGER, active_milestone, as_, assess, declaration,
    document, err, exif_jpeg, image, jfif, judge_answer, milestone, png, rounds, set_now,
    terms,
)


class TestFiling:
    def test_the_contract_hashes_what_it_stores(self, module, c):
        _, mid = active_milestone(module, c)
        eid = image(module, c, mid, caption="The array")
        it = json.loads(c.get_item(eid))
        assert it["kind"] == "IMAGE" and it["role"] == "INSTALLER"
        assert len(it["sha256"]) == 64
        assert it["bytes"] == len(c.get_image(eid))
        assert it["version"] == 1

    def test_only_the_parties_file(self, module, c):
        _, mid = active_milestone(module, c)
        as_(module, STRANGER)
        with pytest.raises(err(module), match="only the owner, the installer"):
            c.submit_image(mid, "{}", jfif())

    def test_the_inspector_accepts_the_role_before_filing(self, module, c):
        from conftest import create_project
        pid = create_project(module, c, inspector=INSPECTOR)
        as_(module, OWNER)
        mid = json.loads(c.add_milestone(pid, terms()))["milestone_id"]
        as_(module, INSTALLER)
        c.accept_project(pid)
        as_(module, INSPECTOR)
        with pytest.raises(err(module), match="accept the inspector role first"):
            c.submit_document(mid, "{}", "Report")

    def test_nothing_is_filed_before_the_terms_are_signed(self, module, c):
        from conftest import create_project
        pid = create_project(module, c, escrow=9 * GEN)
        as_(module, INSTALLER)
        c.accept_project(pid)
        as_(module, OWNER)
        mid = json.loads(c.add_milestone(pid, terms()))["milestone_id"]
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="has not signed the terms yet"):
            c.submit_image(mid, "{}", jfif())

    def test_filing_closes_at_the_deadline(self, module, c):
        _, mid = active_milestone(module, c)
        set_now("2026-10-21T00:00:00Z")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="the deadline has passed"):
            c.submit_image(mid, "{}", jfif())

    def test_each_party_has_its_own_quota(self, module, c):
        _, mid = active_milestone(module, c, inspector=INSPECTOR)
        for i in range(3):
            image(module, c, mid, who=OWNER, req="", caption=f"Owner view {i}")
        as_(module, OWNER)
        with pytest.raises(err(module), match="the 3 images these terms allow you"):
            c.submit_image(mid, "{}", jfif(b"one more"))
        # the installer's own quota is untouched by the owner's
        image(module, c, mid, caption="Installer view")


class TestWhatCountsAsAnImage:
    def test_png_and_jfif_are_accepted(self, module, c):
        _, mid = active_milestone(module, c)
        assert image(module, c, mid, data=png(b"a"), caption="png")
        assert image(module, c, mid, data=jfif(b"b"), caption="jfif")

    def test_an_exif_jpeg_is_refused_in_words(self, module, c):
        """The runner's decoder reads JFIF; an EXIF-headed JPEG is refused
        here rather than failing inside a round."""
        _, mid = active_milestone(module, c)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="PNG and JFIF JPEG only"):
            c.submit_image(mid, "{}", exif_jpeg())

    def test_an_empty_or_oversized_image_is_refused(self, module, c):
        _, mid = active_milestone(module, c)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="that image is empty"):
            c.submit_image(mid, "{}", b"")
        with pytest.raises(err(module), match="at most 400,000 bytes"):
            c.submit_image(mid, "{}", jfif(size=400_001))

    def test_an_empty_document_or_declaration_is_refused(self, module, c):
        _, mid = active_milestone(module, c)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="that document is empty"):
            c.submit_document(mid, "{}", "   ")
        with pytest.raises(err(module), match="that declaration is empty"):
            c.submit_declaration(mid, "")


class TestWhatTheFilerClaims:
    def test_the_ids_a_filer_names_must_exist_in_the_terms(self, module, c):
        _, mid = active_milestone(module, c)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="no evidence requirement R9"):
            c.submit_image(mid, json.dumps({"requirement_id": "R9"}), jfif())
        with pytest.raises(err(module), match="no equipment line E9"):
            c.submit_image(mid, json.dumps({"equipment_id": "E9"}), jfif())

    def test_the_claimed_line_is_recorded_as_a_claim_and_reaches_the_panel_as_one(self, module, c):
        from conftest import prompts
        _, mid = active_milestone(module, c)
        a = image(module, c, mid, line="E2", origin="NAMEPLATE", caption="Inverter label")
        b = image(module, c, mid, line="E1", caption="The array")
        assert json.loads(c.get_item(a))["equipment_id"] == "E2"
        assess(module, c, mid, [a, b])
        judged = [p["prompt"] for p in prompts(kind="judge", role="leader")][0]
        assert "which is their claim" in judged

    def test_an_unreadable_meta_is_refused_in_words(self, module, c):
        _, mid = active_milestone(module, c)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="must be JSON"):
            c.submit_image(mid, "not json", jfif())
        with pytest.raises(err(module), match="photograph, a nameplate"):
            c.submit_image(mid, json.dumps({"origin": "XRAY"}), jfif())


class TestDeclarations:
    def test_a_declaration_is_stored_hashed_and_never_read(self, module, c):
        """From any party: the installer's is never named into a round, and
        the counterparties' are never swept into one either."""
        _, mid = active_milestone(module, c, inspector=INSPECTOR)
        mine = declaration(module, c, mid, text="Everything on site is per the drawings.")
        theirs = declaration(module, c, mid, who=OWNER,
                             text="We say the wrong inverter was fitted.")
        watching = declaration(module, c, mid, who=INSPECTOR,
                               text="I attended site on the stated date.")
        for eid in (mine, theirs, watching):
            it = json.loads(c.get_item(eid))
            assert it["kind"] == "DECLARATION" and len(it["sha256"]) == 64
        a = image(module, c, mid, caption="The array")
        b = image(module, c, mid, caption="The inverter", origin="NAMEPLATE")
        from conftest import prompts
        assess(module, c, mid, [a, b])
        for p in prompts():
            assert "per the drawings" not in p["prompt"]
            assert "wrong inverter was fitted" not in p["prompt"]
            assert "attended site" not in p["prompt"]
        assert [row["item_id"] for row in rounds(c, mid, 1)["evidence"]] == [a, b]

    def test_a_declaration_can_never_be_presented_to_a_round(self, module, c):
        _, mid = active_milestone(module, c)
        said = declaration(module, c, mid)
        image(module, c, mid, caption="one")
        image(module, c, mid, caption="two")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="no round reads one"):
            c.request_assessment(mid, json.dumps([said]))


class TestPresenting:
    def test_the_installer_names_only_their_own_items(self, module, c):
        _, mid = active_milestone(module, c, inspector=INSPECTOR)
        a = image(module, c, mid, caption="one")
        image(module, c, mid, caption="two")
        theirs = image(module, c, mid, who=OWNER, req="", caption="owner view")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="are always read and are never named"):
            c.request_assessment(mid, json.dumps([a, theirs]))

    def test_counterparty_evidence_is_always_read(self, module, c):
        from conftest import prompts
        _, mid = active_milestone(module, c, inspector=INSPECTOR)
        a = image(module, c, mid, caption="one")
        b = image(module, c, mid, caption="two")
        report = document(module, c, mid, who=INSPECTOR, title="Site inspection",
                          text="The inverter is mounted and labelled.")
        out = assess(module, c, mid, [a, b])
        judged = [p["prompt"] for p in prompts(kind="judge", role="leader")][0]
        assert report in judged
        assert out["decision"] in ("ACCEPTED", "REJECTED", "UNDETERMINED")

    def test_an_item_from_another_milestone_is_refused(self, module, c):
        _, mid = active_milestone(module, c, escrow=9 * GEN)
        _, other = active_milestone(module, c, escrow=9 * GEN)
        stray = image(module, c, other, caption="elsewhere")
        image(module, c, mid, caption="one")
        image(module, c, mid, caption="two")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="is not evidence filed against these terms"):
            c.request_assessment(mid, json.dumps([stray]))

    def test_naming_the_same_item_twice_is_refused(self, module, c):
        _, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="one")
        image(module, c, mid, caption="two")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="named twice"):
            c.request_assessment(mid, json.dumps([a, a]))

    def test_one_round_reads_a_bounded_number_from_the_installer(self, module, c):
        _, mid = active_milestone(module, c)
        many = [image(module, c, mid, caption=f"view {i}") for i in range(5)]
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="at most 4 images"):
            c.request_assessment(mid, json.dumps(many))

    def test_an_assessment_needs_the_evidence_the_terms_require(self, module, c):
        _, mid = active_milestone(module, c)
        one = image(module, c, mid, caption="only one")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="needs 2 items from the installer"):
            c.request_assessment(mid, json.dumps([one]))

    def test_an_assessment_with_nothing_presented_is_refused(self, module, c):
        _, mid = active_milestone(module, c)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="present at least one"):
            c.request_assessment(mid, json.dumps([]))

    def test_filed_evidence_never_changes(self, module, c):
        _, mid = active_milestone(module, c)
        a = image(module, c, mid, caption="one")
        b = image(module, c, mid, caption="two")
        before = json.loads(c.get_item(a))
        assess(module, c, mid, [a, b])
        assert json.loads(c.get_item(a)) == before

