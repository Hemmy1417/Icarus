/**
 * The acts layer decides what each person is offered and what they are told
 * instead. It mirrors the contract's own checks, so the thing worth testing
 * is that it mirrors them faithfully: an act the contract would refuse must
 * never be offered, and an act it would allow must never be withheld.
 *
 * Every clock here is the chain's, passed in, never the browser's.
 */
import { describe, expect, it } from "vitest";

import { MARGIN_MS, milestoneActs, projectActs, roleIn, workedExample } from "@/lib/acts";
import type { Config, Milestone, Project, Standing } from "@/lib/types";

const OWNER = "0x1111111111111111111111111111111111111111";
const INSTALLER = "0x2222222222222222222222222222222222222222";
const INSPECTOR = "0x3333333333333333333333333333333333333333";
const STRANGER = "0x9999999999999999999999999999999999999999";

const NOW = Date.parse("2026-09-20T18:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const config = {
  max_versions_per_milestone: 3,
  max_assessments_per_version: 5,
  appeal_lapse_seconds: 3 * 86400,
} as Config;

function project(over: Partial<Project> = {}): Project {
  return {
    project_id: "pr-00001", title: "A project", description: "", site: "", system_type: "COMMERCIAL_SOLAR",
    capacity_kw: "", state: "ACTIVE", owner: OWNER, installer: INSTALLER, inspector: "",
    installer_accepted_at: iso(NOW - 86_400_000), inspector_accepted_at: null,
    appeal_window_seconds: 600, created_at: iso(NOW - 86_400_000),
    escrow_wei: "3000000000000000000", funded_wei: "3000000000000000000",
    reserved_wei: "2000000000000000000", unreserved_wei: "1000000000000000000",
    paid_wei: "0", returned_wei: "0", milestones: ["ms-00001"], milestone_summaries: [],
    events_count: 0, now: iso(NOW), ...over,
  };
}

function milestone(over: Partial<Milestone> = {}): Milestone {
  return {
    milestone_id: "ms-00001", project_id: "pr-00001", index: 0, state: "AWAITING_EVIDENCE",
    current_version: 1, pending_version: null,
    versions: [{
      version: 1, title: "A milestone", milestone_type: "INVERTER_INSTALLATION", description: "",
      specification: "", requirements: "", payment_wei: "2000000000000000000",
      deadline: iso(NOW + 14 * 86_400_000), equipment: [], criteria: [], evidence_requirements: [],
    }],
    evidence: {}, rounds_count: 0, version_assessments: 0, standing: null, appeal: null,
    reserved_wei: "2000000000000000000", created_at: iso(NOW - 86_400_000),
    closed_at: null, close_reason: null, now: iso(NOW), ...over,
  };
}

const standing = (over: Partial<Standing> = {}): Standing => ({
  round: 1, decision: "ACCEPTED", at: iso(NOW - 60_000), kind: "ASSESSMENT",
  appealable: true, appealed: false, window_ends: iso(NOW + 600_000), item_mark: 2, ...over,
});

const act = (acts: ReturnType<typeof milestoneActs>, id: string) => acts.find((a) => a.id === id);

const actsFor = (addr: string, m: Milestone, p = project(), nowMs = NOW) =>
  milestoneActs({ project: p, milestone: m, addr, config, nowMs });

describe("who a viewer is", () => {
  it("recognises each party and nobody else", () => {
    const p = project({ inspector: INSPECTOR });
    expect(roleIn(p, OWNER)).toBe("OWNER");
    expect(roleIn(p, INSTALLER)).toBe("INSTALLER");
    expect(roleIn(p, INSPECTOR)).toBe("INSPECTOR");
    expect(roleIn(p, STRANGER)).toBeNull();
  });

  it("matches an address whatever case the wallet reports it in", () => {
    expect(roleIn(project(), OWNER.toUpperCase().replace("0X", "0x"))).toBe("OWNER");
  });
});

describe("a stranger is offered nothing", () => {
  it("cannot file, assess, contest or close", () => {
    const acts = actsFor(STRANGER, milestone());
    for (const id of ["submit_image", "submit_document", "request_assessment", "open_appeal", "close_milestone"]) {
      expect(act(acts, id), `${id} should not be offered to a stranger`).toBeUndefined();
    }
  });

  it("is still offered the permissionless acts, which cannot change an outcome", () => {
    const m = milestone({ state: "ACCEPTED", standing: standing({ window_ends: iso(NOW - 1) }) });
    expect(act(actsFor(STRANGER, m), "finalize")?.available).toBe(true);
  });
});

describe("evidence", () => {
  it("is open to a party while the milestone takes evidence", () => {
    expect(act(actsFor(INSTALLER, milestone()), "submit_image")?.available).toBe(true);
  });

  it("closes a minute before the deadline, not at it", () => {
    const m = milestone();
    const deadline = Date.parse(m.versions[0]!.deadline);
    expect(act(actsFor(INSTALLER, m, project(), deadline - MARGIN_MS - 1000), "submit_image")?.available).toBe(true);
    expect(act(actsFor(INSTALLER, m, project(), deadline - MARGIN_MS + 1000), "submit_image")?.available).toBe(false);
  });

  it("reopens during an appeal's evidence period", () => {
    const m = milestone({
      state: "APPEALED",
      appeal: { reviewed_round: 1, reason: "", opened_at: iso(NOW), evidence_ends: iso(NOW + 600_000), by: OWNER },
      standing: standing({ appealed: true }),
    });
    expect(act(actsFor(INSTALLER, m), "submit_image")?.available).toBe(true);
  });

  it("says a declaration is never read, so nobody mistakes it for evidence", () => {
    const said = act(actsFor(OWNER, milestone()), "submit_declaration")?.reason ?? "";
    expect(said).toMatch(/never read by the panel/i);
  });
});

describe("assessment", () => {
  it("stops once the terms have had every assessment they allow", () => {
    const m = milestone({ version_assessments: 5 });
    const a = act(actsFor(INSTALLER, m), "request_assessment");
    expect(a?.available).toBe(false);
    expect(a?.reason).toMatch(/every assessment they allow/i);
  });

  it("is open below the cap", () => {
    expect(act(actsFor(INSTALLER, milestone({ version_assessments: 4 })), "request_assessment")?.available).toBe(true);
  });
});

describe("contesting a decision", () => {
  it("is the owner's, inside the window, once", () => {
    const m = milestone({ state: "ACCEPTED", standing: standing() });
    expect(act(actsFor(OWNER, m), "open_appeal")?.available).toBe(true);
    expect(act(actsFor(INSTALLER, m), "open_appeal")).toBeUndefined();
  });

  it("closes a minute early, because a round takes time to land", () => {
    const m = milestone({ state: "ACCEPTED", standing: standing({ window_ends: iso(NOW + MARGIN_MS - 1000) }) });
    const a = act(actsFor(OWNER, m), "open_appeal");
    expect(a?.available).toBe(false);
    expect(a?.reason).toMatch(/window .* has closed/i);
  });

  it("is refused a second time", () => {
    const m = milestone({ state: "ACCEPTED", standing: standing({ appealed: true }) });
    expect(act(actsFor(OWNER, m), "open_appeal")?.available).toBe(false);
  });
});

describe("an open appeal", () => {
  const appealed = (endsMs: number) => milestone({
    state: "APPEALED",
    appeal: { reviewed_round: 1, reason: "", opened_at: iso(NOW - 1000), evidence_ends: iso(endsMs), by: OWNER },
    standing: standing({ appealed: true }),
  });

  it("cannot be decided while it is still taking evidence", () => {
    expect(act(actsFor(STRANGER, appealed(NOW + 600_000)), "decide_appeal")?.available).toBe(false);
  });

  it("can be decided by anyone once the period ends", () => {
    expect(act(actsFor(STRANGER, appealed(NOW - 1000)), "decide_appeal")?.available).toBe(true);
  });

  it("lapses only after three days, and then to nobody's advantage", () => {
    const justAfter = appealed(NOW - 1000);
    expect(act(actsFor(STRANGER, justAfter), "lapse_appeal")?.available).toBe(false);
    const old = appealed(NOW - 4 * 86_400_000);
    const a = act(actsFor(STRANGER, old), "lapse_appeal");
    expect(a?.available).toBe(true);
    expect(a?.reason).toMatch(/pay nothing/i);
  });
});

describe("settlement", () => {
  it("waits for the window when the decision was never contested", () => {
    const inWindow = milestone({ state: "ACCEPTED", standing: standing() });
    expect(act(actsFor(STRANGER, inWindow), "finalize")?.available).toBe(false);
    const past = milestone({ state: "ACCEPTED", standing: standing({ window_ends: iso(NOW - 1) }) });
    expect(act(actsFor(STRANGER, past), "finalize")?.available).toBe(true);
  });

  it("does not wait when the decision was already contested and upheld", () => {
    const m = milestone({ state: "ACCEPTED", standing: standing({ appealed: true, kind: "APPEAL" }) });
    expect(act(actsFor(STRANGER, m), "finalize")?.available).toBe(true);
  });

  it("never offers to settle a milestone no panel accepted", () => {
    for (const d of ["REJECTED", "UNDETERMINED"] as const) {
      const m = milestone({ state: d, standing: standing({ decision: d, appealable: true }) });
      const a = act(actsFor(STRANGER, m), "finalize");
      expect(a?.available).toBe(false);
      expect(a?.reason).toMatch(/until a panel accepts/i);
    }
  });
});

describe("the project", () => {
  it("offers the installer a signature only while it is proposed", () => {
    const acts = projectActs(project({ state: "PROPOSED", installer_accepted_at: null }), INSTALLER);
    expect(acts.find((a) => a.id === "accept_project")?.available).toBe(true);
    expect(projectActs(project(), INSTALLER).find((a) => a.id === "accept_project")?.available).toBe(false);
  });

  it("lets the owner take back only unreserved escrow", () => {
    expect(projectActs(project(), OWNER).find((a) => a.id === "withdraw_escrow")?.available).toBe(true);
    const full = project({ unreserved_wei: "0" });
    expect(projectActs(full, OWNER).find((a) => a.id === "withdraw_escrow")?.available).toBe(false);
  });

  it("refuses to cancel once a milestone has settled", () => {
    const p = project({
      milestone_summaries: [{
        milestone_id: "ms-00001", index: 0, title: "", milestone_type: "COMMISSIONING",
        state: "FINALIZED", deadline: iso(NOW), payment_wei: "0", current_version: 1,
        latest_version: 1, pending_version: null, rounds_count: 1, schedule_lines: 1,
        standing: null, appeal: null,
      }],
    });
    const a = projectActs(p, OWNER).find((x) => x.id === "cancel_project");
    expect(a?.available).toBe(false);
    expect(a?.reason).toMatch(/already settled/i);
  });
});

describe("the worked example the cover features", () => {
  const summary = (over: Record<string, unknown>) => ({
    milestone_id: "ms-00001", index: 0, title: "", milestone_type: "COMMISSIONING",
    state: "AWAITING_EVIDENCE", deadline: iso(NOW), payment_wei: "0", current_version: 1,
    latest_version: 1, pending_version: null, rounds_count: 0, schedule_lines: 1,
    standing: null, appeal: null, ...over,
  }) as Project["milestone_summaries"][number];

  it("prefers one that was settled after being contested", () => {
    const p = project({
      milestone_summaries: [
        summary({ milestone_id: "ms-00002", rounds_count: 1 }),
        summary({ milestone_id: "ms-00003", state: "FINALIZED", rounds_count: 2, standing: standing({ appealed: true }) }),
      ],
    });
    expect(workedExample(p)?.milestone_id).toBe("ms-00003");
  });

  it("features nothing rather than something undecided", () => {
    expect(workedExample(project({ milestone_summaries: [summary({})] }))).toBeNull();
    expect(workedExample(null)).toBeNull();
  });
});
