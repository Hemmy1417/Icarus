"""The terms, and above all the equipment schedule: what the contract will
accept as something a photograph can be matched against."""
import json

import pytest

from conftest import (  # noqa: F401
    GEN, INSPECTOR, INSTALLER, OWNER, SCHEDULE, STRANGER, active_milestone, as_,
    create_project, err, milestone, project, set_now, terms,
)


def add(c, module, pid, **over):
    as_(module, OWNER)
    return json.loads(c.add_milestone(pid, terms(**over)))


class TestTheSchedule:
    def test_a_line_needs_a_role_a_manufacturer_and_a_model(self, module, c):
        pid = create_project(module, c)
        for line, says in [
            ({"role": "TURBINE", "manufacturer": "A", "model": "B"}, "needs a role"),
            ({"role": "MODULE", "manufacturer": "", "model": "B"}, "manufacturer and a model"),
            ({"role": "MODULE", "manufacturer": "A", "model": ""}, "manufacturer and a model"),
            ({"role": "MODULE", "manufacturer": "A", "model": "B", "quantity": 0},
             "quantity of at least one"),
        ]:
            as_(module, OWNER)
            with pytest.raises(err(module), match=says):
                c.add_milestone(pid, terms(equipment=[line]))

    def test_the_schedule_is_canonical_once_stored(self, module, c):
        pid = create_project(module, c)
        mid = add(c, module, pid)["milestone_id"]
        lines = milestone(c, mid)["versions"][0]["equipment"]
        assert [line["id"] for line in lines] == ["E1", "E2", "E3"]
        assert lines[0]["role"] == "MODULE"
        assert lines[0]["quantity"] == 92
        assert lines[1]["identify"] is True
        assert lines[2]["identify"] is False

    def test_a_milestone_needs_something_to_judge(self, module, c):
        pid = create_project(module, c)
        as_(module, OWNER)
        with pytest.raises(err(module), match="nothing for the evidence to be judged against"):
            c.add_milestone(pid, terms(equipment=[], criteria=[]))

    def test_a_schedule_alone_is_enough_and_so_are_criteria_alone(self, module, c):
        pid = create_project(module, c, escrow=9 * GEN)
        assert add(c, module, pid, criteria=[])["version"] == 1
        assert add(c, module, pid, equipment=[],
                   evidence_requirements=[])["version"] == 1

    def test_identification_needs_somebody_obliged_to_photograph_it(self, module, c):
        """Terms that ask for a nameplate but oblige nobody to file an image
        could never be satisfied; they are refused when proposed."""
        pid = create_project(module, c)
        as_(module, OWNER)
        with pytest.raises(err(module), match="at least one image from the installer"):
            c.add_milestone(pid, terms(evidence_requirements=[
                {"text": "Commissioning report", "kind": "DOCUMENT",
                 "from_role": "INSTALLER", "min_count": 1}]))

    def test_a_schedule_without_identification_needs_no_image_requirement(self, module, c):
        pid = create_project(module, c)
        plain = [dict(line, identify=False) for line in SCHEDULE]
        assert add(c, module, pid, equipment=plain, evidence_requirements=[
            {"text": "Commissioning report", "kind": "DOCUMENT",
             "from_role": "INSTALLER", "min_count": 1}])["version"] == 1

    def test_the_schedule_is_bounded(self, module, c):
        pid = create_project(module, c)
        many = [{"role": "MODULE", "manufacturer": "A", "model": f"M{i}"} for i in range(11)]
        as_(module, OWNER)
        with pytest.raises(err(module), match="at most 10 lines"):
            c.add_milestone(pid, terms(equipment=many))


class TestTheRestOfTheTerms:
    @pytest.mark.parametrize("over,says", [
        ({"milestone_type": "SOMETHING"}, "milestone type must be one of"),
        ({"title": ""}, "needs a title"),
        ({"requirements": "  "}, "requirements in words"),
        ({"payment_wei": str(10**15)}, "at least 0.01 GEN"),
        ({"deadline": "2020-01-01T00:00:00Z"}, "must lie in the future"),
        ({"deadline": "not a date"}, "ISO date-time"),
        ({"criteria": [{"text": ""}]}, "criterion 1 is empty"),
    ])
    def test_terms_are_refused_in_words(self, module, c, over, says):
        pid = create_project(module, c)
        as_(module, OWNER)
        with pytest.raises(err(module), match=says):
            c.add_milestone(pid, terms(**over))

    def test_a_deadline_more_than_a_year_out_is_refused(self, module, c):
        pid = create_project(module, c)
        as_(module, OWNER)
        with pytest.raises(err(module), match="more than 365 days out"):
            c.add_milestone(pid, terms(deadline="2028-01-01T00:00:00Z"))

    def test_evidence_requirements_are_validated(self, module, c):
        pid = create_project(module, c)
        for reqs, says in [
            ([{"text": "", "kind": "IMAGE", "from_role": "INSTALLER"}], "needs its text"),
            ([{"text": "x", "kind": "VIDEO", "from_role": "INSTALLER"}], "images or documents"),
            ([{"text": "x", "kind": "IMAGE", "from_role": "OWNER"}], "installer or the inspector"),
            ([{"text": "x", "kind": "IMAGE", "from_role": "INSTALLER", "min_count": 0}],
             "count of at least one"),
        ]:
            as_(module, OWNER)
            with pytest.raises(err(module), match=says):
                c.add_milestone(pid, terms(evidence_requirements=reqs))

    def test_terms_cannot_ask_an_inspector_a_project_never_named(self, module, c):
        pid = create_project(module, c)
        as_(module, OWNER)
        with pytest.raises(err(module), match="this project names none"):
            c.add_milestone(pid, terms(evidence_requirements=[
                {"text": "Site inspection report", "kind": "DOCUMENT",
                 "from_role": "INSPECTOR", "min_count": 1}]))

    def test_terms_cannot_ask_for_more_than_one_round_reads(self, module, c):
        pid = create_project(module, c)
        as_(module, OWNER)
        with pytest.raises(err(module), match="more items than one assessment reads"):
            c.add_milestone(pid, terms(evidence_requirements=[
                {"text": "Photographs", "kind": "IMAGE",
                 "from_role": "INSTALLER", "min_count": 9}]))


class TestReservation:
    def test_a_milestone_reserves_its_payment_when_it_is_proposed(self, module, c):
        pid = create_project(module, c, escrow=5 * GEN)
        add(c, module, pid)
        p = project(c, pid)
        assert p["reserved_wei"] == str(2 * GEN)
        assert p["unreserved_wei"] == str(3 * GEN)

    def test_two_milestones_can_never_be_funded_from_the_same_gen(self, module, c):
        pid = create_project(module, c, escrow=3 * GEN)
        add(c, module, pid)
        as_(module, OWNER)
        with pytest.raises(err(module), match="less free than this milestone reserves"):
            c.add_milestone(pid, terms())

    def test_reserved_escrow_cannot_be_withdrawn(self, module, c):
        pid = create_project(module, c, escrow=3 * GEN)
        add(c, module, pid)
        as_(module, OWNER)
        with pytest.raises(err(module), match="more than the escrow"):
            c.withdraw_escrow(pid, str(2 * GEN))
        c.withdraw_escrow(pid, str(GEN))

    def test_only_the_owner_proposes_milestones(self, module, c):
        pid = create_project(module, c)
        for who in (INSTALLER, STRANGER):
            as_(module, who)
            with pytest.raises(err(module), match="only the owner proposes"):
                c.add_milestone(pid, terms())


class TestVersions:
    def test_signing_the_project_signs_the_terms_proposed_so_far(self, module, c):
        pid = create_project(module, c)
        mid = add(c, module, pid)["milestone_id"]
        assert milestone(c, mid)["state"] == "AWAITING_TERMS"
        as_(module, INSTALLER)
        out = json.loads(c.accept_project(pid))
        assert out["terms_signed"] == [mid]
        m = milestone(c, mid)
        assert m["state"] == "AWAITING_EVIDENCE" and m["current_version"] == 1

    def test_terms_whose_own_deadline_passed_are_not_signed_into_force(self, module, c):
        pid = create_project(module, c)
        mid = add(c, module, pid)["milestone_id"]
        set_now("2026-10-21T00:00:00Z")
        as_(module, INSTALLER)
        assert json.loads(c.accept_project(pid))["terms_signed"] == []
        assert milestone(c, mid)["current_version"] == 0

    def test_new_terms_stand_only_once_signed(self, module, c):
        pid, mid = active_milestone(module, c, escrow=9 * GEN)
        as_(module, OWNER)
        out = json.loads(c.propose_version(mid, terms(payment_wei=str(3 * GEN))))
        assert out["version"] == 2 and out["pending"] is True
        m = milestone(c, mid)
        assert m["current_version"] == 1 and m["pending_version"] == 2
        assert m["reserved_wei"] == str(2 * GEN), "the old terms still hold the reservation"
        as_(module, INSTALLER)
        c.accept_version(mid, 2)
        m = milestone(c, mid)
        assert m["current_version"] == 2 and m["pending_version"] is None
        assert m["reserved_wei"] == str(3 * GEN)
        assert project(c, pid)["reserved_wei"] == str(3 * GEN)

    def test_a_version_whose_deadline_has_passed_is_never_signed_into_force(self, module, c):
        _, mid = active_milestone(module, c, escrow=9 * GEN)
        as_(module, OWNER)
        c.propose_version(mid, terms(deadline="2026-10-01T00:00:00Z"))
        set_now("2026-10-02T00:00:00Z")
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="that version's deadline has passed"):
            c.accept_version(mid, 2)

    def test_only_the_installer_signs_and_only_the_pending_version(self, module, c):
        _, mid = active_milestone(module, c, escrow=9 * GEN)
        as_(module, OWNER)
        c.propose_version(mid, terms(payment_wei=str(3 * GEN)))
        as_(module, OWNER)
        with pytest.raises(err(module), match="only the installer signs"):
            c.accept_version(mid, 2)
        as_(module, INSTALLER)
        with pytest.raises(err(module), match="not the one awaiting your signature"):
            c.accept_version(mid, 1)

    def test_a_milestone_holds_a_bounded_number_of_versions(self, module, c):
        _, mid = active_milestone(module, c, escrow=9 * GEN)
        for v in range(2, 7):
            as_(module, OWNER)
            c.propose_version(mid, terms())
            as_(module, INSTALLER)
            c.accept_version(mid, v)
        as_(module, OWNER)
        with pytest.raises(err(module), match="at most 6 versions"):
            c.propose_version(mid, terms())

    def test_new_terms_cannot_reserve_more_than_the_escrow_holds(self, module, c):
        _, mid = active_milestone(module, c, escrow=3 * GEN)
        as_(module, OWNER)
        with pytest.raises(err(module), match="less free than the new payment"):
            c.propose_version(mid, terms(payment_wei=str(4 * GEN)))
