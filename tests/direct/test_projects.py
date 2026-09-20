"""Projects: who may do what, and where the money is at every step."""
import json

import pytest

from conftest import (  # noqa: F401
    DEPLOYER, GEN, INSPECTOR, INSTALLER, OWNER, STRANGER, as_, claimable, create_project,
    err, project, project_params, set_now, transfers,
)


class TestCreation:
    def test_the_signer_becomes_the_owner_and_the_value_is_the_escrow(self, module, c):
        pid = create_project(module, c, escrow=5 * GEN)
        p = project(c, pid)
        assert p["owner"] == OWNER
        assert p["installer"] == INSTALLER
        assert p["state"] == "PROPOSED"
        assert p["escrow_wei"] == str(5 * GEN)
        assert p["unreserved_wei"] == str(5 * GEN)

    def test_a_project_can_open_with_no_escrow(self, module, c):
        pid = create_project(module, c, escrow=0)
        assert project(c, pid)["escrow_wei"] == "0"

    @pytest.mark.parametrize("over,says", [
        ({"title": ""}, "needs a title"),
        ({"system_type": "WIND"}, "system type must be one of"),
        ({"installer": "not an address"}, "installer must be a wallet address"),
        ({"installer": OWNER}, "cannot also be the installer"),
        ({"inspector": INSTALLER}, "neither the owner nor the installer"),
        ({"appeal_window_seconds": 10}, "between 10 minutes and 7 days"),
        ({"appeal_window_seconds": 999999}, "between 10 minutes and 7 days"),
    ])
    def test_a_refused_creation_returns_the_value_instead_of_keeping_it(self, module, c, over, says):
        as_(module, OWNER, 3 * GEN)
        params = {"installer": INSTALLER}
        params.update(over)
        out = json.loads(c.create_project(project_params(**params)))
        assert out["refused"] is True
        assert says in out["reason"], out["reason"]
        assert claimable(c, OWNER) == 3 * GEN

    def test_malformed_parameters_are_refused_in_words_not_a_crash(self, module, c):
        as_(module, OWNER, GEN)
        out = json.loads(c.create_project("not json at all"))
        assert out["refused"] is True
        assert claimable(c, OWNER) == GEN

    def test_being_named_in_a_project_indexes_every_party_once(self, module, c):
        pid = create_project(module, c, inspector=INSPECTOR)
        for who in (OWNER, INSTALLER, INSPECTOR):
            page = json.loads(c.projects_of(who, 0, 10))
            assert page["total"] == 1
            assert page["project_ids"] == [pid]
        assert json.loads(c.projects_of(STRANGER, 0, 10))["total"] == 0

    def test_the_index_order_never_depends_on_hashing(self, module, c):
        """Two projects, and every party's page reads newest first. The order
        of the writes inside one creation must not vary between nodes."""
        first = create_project(module, c, inspector=INSPECTOR)
        second = create_project(module, c, inspector=INSPECTOR)
        for who in (OWNER, INSTALLER, INSPECTOR):
            assert json.loads(c.projects_of(who, 0, 10))["project_ids"] == [second, first]


class TestSigning:
    def test_only_the_named_installer_signs(self, module, c):
        pid = create_project(module, c)
        for who in (OWNER, INSPECTOR, STRANGER):
            as_(module, who)
            with pytest.raises(err(module), match="only the named installer"):
                c.accept_project(pid)
        as_(module, INSTALLER)
        c.accept_project(pid)
        assert project(c, pid)["state"] == "ACTIVE"

    def test_signing_twice_is_refused(self, module, c):
        pid = create_project(module, c)
        as_(module, INSTALLER)
        c.accept_project(pid)
        with pytest.raises(err(module), match="already signed"):
            c.accept_project(pid)

    def test_only_the_named_inspector_accepts_the_role(self, module, c):
        pid = create_project(module, c, inspector=INSPECTOR)
        as_(module, STRANGER)
        with pytest.raises(err(module), match="only the named inspector"):
            c.accept_inspector_role(pid)
        as_(module, INSPECTOR)
        c.accept_inspector_role(pid)
        assert project(c, pid)["inspector_accepted_at"]
        with pytest.raises(err(module), match="already accepted"):
            c.accept_inspector_role(pid)

    def test_a_project_with_no_inspector_has_no_inspector_role(self, module, c):
        pid = create_project(module, c)
        as_(module, INSPECTOR)
        with pytest.raises(err(module), match="only the named inspector"):
            c.accept_inspector_role(pid)


class TestMoney:
    def test_anyone_may_fund_and_only_the_owner_withdraws(self, module, c):
        pid = create_project(module, c, escrow=GEN)
        as_(module, STRANGER, 2 * GEN)
        assert json.loads(c.fund_project(pid))["refused"] is False
        assert project(c, pid)["escrow_wei"] == str(3 * GEN)
        as_(module, STRANGER)
        with pytest.raises(err(module), match="only the owner withdraws"):
            c.withdraw_escrow(pid, str(GEN))
        as_(module, OWNER)
        c.withdraw_escrow(pid, str(3 * GEN))
        assert claimable(c, OWNER) == 3 * GEN
        assert project(c, pid)["escrow_wei"] == "0"

    def test_funding_a_cancelled_project_returns_the_value(self, module, c):
        pid = create_project(module, c, escrow=GEN)
        as_(module, OWNER)
        c.cancel_project(pid)
        as_(module, STRANGER, 2 * GEN)
        out = json.loads(c.fund_project(pid))
        assert out["refused"] is True
        assert claimable(c, STRANGER) == 2 * GEN

    def test_funding_an_unknown_project_returns_the_value(self, module, c):
        as_(module, STRANGER, GEN)
        out = json.loads(c.fund_project("pr-99999"))
        assert out["refused"] is True
        assert claimable(c, STRANGER) == GEN

    def test_a_cancelled_project_returns_the_whole_escrow_as_a_claim(self, module, c):
        pid = create_project(module, c, escrow=4 * GEN)
        as_(module, OWNER)
        out = json.loads(c.cancel_project(pid))
        assert out["state"] == "CANCELLED"
        assert claimable(c, OWNER) == 4 * GEN
        p = project(c, pid)
        assert p["escrow_wei"] == "0" and p["reserved_wei"] == "0"
        assert p["returned_wei"] == str(4 * GEN)
        assert transfers() == [], "cancelling pushes nothing; it creates a claim"

    def test_a_signed_project_can_no_longer_be_cancelled(self, module, c):
        pid = create_project(module, c)
        as_(module, INSTALLER)
        c.accept_project(pid)
        as_(module, OWNER)
        with pytest.raises(err(module), match="close its milestones instead"):
            c.cancel_project(pid)

    def test_only_the_owner_cancels(self, module, c):
        pid = create_project(module, c)
        for who in (INSTALLER, STRANGER):
            as_(module, who)
            with pytest.raises(err(module), match="only the owner cancels"):
                c.cancel_project(pid)

    def test_claiming_sends_once_and_leaves_nothing_behind(self, module, c):
        pid = create_project(module, c, escrow=2 * GEN)
        as_(module, OWNER)
        c.withdraw_escrow(pid, str(2 * GEN))
        as_(module, OWNER)
        out = json.loads(c.claim())
        assert out["claimed_wei"] == str(2 * GEN)
        assert transfers() == [{"to": OWNER, "wei": 2 * GEN}]
        assert claimable(c, OWNER) == 0
        with pytest.raises(err(module), match="nothing is owed"):
            c.claim()

    def test_withdrawing_more_than_is_free_is_refused(self, module, c):
        pid = create_project(module, c, escrow=GEN)
        as_(module, OWNER)
        with pytest.raises(err(module), match="more than the escrow"):
            c.withdraw_escrow(pid, str(2 * GEN))
        with pytest.raises(err(module), match="name an amount"):
            c.withdraw_escrow(pid, "0")


class TestReading:
    def test_views_refuse_an_address_they_cannot_read(self, module, c):
        with pytest.raises(err(module), match="not a wallet address"):
            c.projects_of("nonsense", 0, 10)
        with pytest.raises(err(module), match="not a wallet address"):
            c.get_balance("nonsense")

    def test_views_refuse_a_record_that_does_not_exist(self, module, c):
        with pytest.raises(err(module), match="unknown project"):
            c.get_project("pr-00042")
        with pytest.raises(err(module), match="unknown milestone"):
            c.get_milestone("ms-00042")
        with pytest.raises(err(module), match="unknown evidence item"):
            c.get_item("ev-000042")

    def test_the_register_pages_newest_first(self, module, c):
        ids = [create_project(module, c, escrow=0) for _ in range(3)]
        page = json.loads(c.list_projects(0, 2))
        assert page["total"] == 3
        assert page["project_ids"] == [ids[2], ids[1]]
        assert json.loads(c.list_projects(2, 2))["project_ids"] == [ids[0]]
        assert json.loads(c.list_projects(9, 2))["project_ids"] == []

    def test_the_config_names_every_limit_the_contract_enforces(self, module, c):
        cfg = json.loads(c.get_config())
        assert cfg["ruleset"] == "icarus-rules-1"
        assert cfg["images_per_prompt"] == 2
        assert "MODULE" in cfg["equipment_roles"]
        assert "INSTALLED" in cfg["line_statuses"]
        assert cfg["quotas"]["INSTALLER"]["IMAGE"] >= 1
