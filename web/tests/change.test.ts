/**
 * The two rules a job needs once it is under way: a substitute for one line
 * of the schedule, and a cure round for a decision that fell short. What is
 * tested is that the interface offers each act exactly where the contract
 * would hear it, and says in words why it does not.
 *
 * Every record here has the shape the contract writes. A substitution is
 * built by `proposal()`, which copies propose_substitution(); a standing by
 * `fellShort()`, which copies _record_round() for a decision that did not
 * accept.
 */
import { describe, expect, it } from "vitest";

import { MARGIN_MS, filedSince, methodOf, milestoneActs, openSubstitution, workEndsMs } from "@/lib/acts";
import { proposalProblem } from "@/components/SubstitutePanel";
import { withinCaps } from "@/components/PresentPanel";
import {
  eventKind, meets, productName, publisher, roundKind, siteOf, substitutionSaid, substitutionStatus,
  verdictSaid,
} from "@/lib/present";
import type {
  Config, EquipmentLine, EvidenceItem, Milestone, Project, Standing, Substitution,
} from "@/lib/types";

const OWNER = "0x1111111111111111111111111111111111111111";
const INSTALLER = "0x2222222222222222222222222222222222222222";
const STRANGER = "0x9999999999999999999999999999999999999999";

const NOW = Date.parse("2026-10-05T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const DEADLINE = NOW + 14 * 86_400_000;

const config = {
  max_versions_per_milestone: 6,
  max_assessments_per_version: 5,
  max_substitutions_per_version: 3,
  appeal_lapse_seconds: 3 * 86400,
} as Config;

const LINE: EquipmentLine = {
  id: "E1", role: "INVERTER", manufacturer: "Growatt", model: "MOD 3000TL3-X", rating: "3 kW",
  quantity: 1, identify: true, or_equivalent: true,
};

const project: Project = {
  project_id: "pr-00001", title: "A project", description: "", site: "", system_type: "COMMERCIAL_SOLAR",
  capacity_kw: "", state: "ACTIVE", owner: OWNER, installer: INSTALLER, inspector: "",
  installer_accepted_at: iso(NOW - 86_400_000), inspector_accepted_at: null,
  appeal_window_seconds: 600, created_at: iso(NOW - 86_400_000),
  escrow_wei: "3000000000000000000", funded_wei: "3000000000000000000",
  reserved_wei: "2000000000000000000", unreserved_wei: "1000000000000000000",
  paid_wei: "0", returned_wei: "0", milestones: ["ms-00001"], milestone_summaries: [],
  events_count: 0, now: iso(NOW),
};

function item(n: number, over: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    item_id: `ev-${String(n).padStart(6, "0")}`, milestone_id: "ms-00001", project_id: "pr-00001",
    kind: "IMAGE", role: "INSTALLER", filed_by: INSTALLER, filed_at: iso(NOW), version: 1,
    sha256: "", bytes: 1, caption: "", origin: "PHOTO", equipment_id: "E1", requirement_id: "R1",
    claimed_capture: "", claimed_location: "", ...over,
  };
}

function milestone(over: Partial<Milestone> = {}): Milestone {
  return {
    milestone_id: "ms-00001", project_id: "pr-00001", index: 1, state: "AWAITING_EVIDENCE",
    current_version: 1, pending_version: null,
    versions: [{
      version: 1, title: "A milestone", milestone_type: "INVERTER_INSTALLATION", description: "",
      specification: "", requirements: "", payment_wei: "2000000000000000000",
      deadline: iso(DEADLINE), equipment: [LINE], criteria: [], evidence_requirements: [],
    }],
    evidence: { "1": [item(1), item(2)] }, rounds_count: 0, version_assessments: 0,
    standing: null, appeal: null, substitutions: [], schedule: [LINE], cure_until: null,
    reserved_wei: "2000000000000000000", created_at: iso(NOW - 86_400_000),
    closed_at: null, close_reason: null, now: iso(NOW), ...over,
  };
}

/** propose_substitution(): a proposal as the contract first records it. */
function proposal(over: Partial<Substitution> = {}): Substitution {
  return {
    id: "S1", version: 1, line_id: "E1", role: "INVERTER",
    signed: { manufacturer: "Growatt", model: "MOD 3000TL3-X", rating: "3 kW" },
    replaces: { manufacturer: "Growatt", model: "MOD 3000TL3-X", rating: "3 kW" },
    substitute: { manufacturer: "Growatt", model: "MOD 4000TL3-X", rating: "4 kW" },
    page: "https://www.example-seller.com/mod-4000tl3-x", reason: "Out of stock.",
    or_equivalent: true, status: "PROPOSED", proposed_at: iso(NOW - 60_000),
    respond_by: iso(NOW + 540_000), objection: "", answered_at: null, decided_at: null,
    verdict: null, findings: null, void_reason: "", ...over,
  };
}

/** _record_round(): the standing a decision that did not accept leaves. */
const fellShort = (over: Partial<Standing> = {}): Standing => ({
  round: 1, decision: "REJECTED", at: iso(NOW - 60_000), kind: "ASSESSMENT",
  appealable: true, appealed: false, window_ends: iso(NOW + 540_000), item_mark: 2, ...over,
});

/** A milestone a panel rejected a minute ago, with a cure period to the deadline. */
const rejected = (over: Partial<Milestone> = {}) =>
  milestone({ state: "REJECTED", standing: fellShort(), rounds_count: 1, version_assessments: 1,
              cure_until: iso(DEADLINE), ...over });

const actsFor = (addr: string, m: Milestone, nowMs = NOW, standingConflict = false) =>
  milestoneActs({ project, milestone: m, addr, config, nowMs, standingConflict });
const act = (acts: ReturnType<typeof milestoneActs>, id: string) => acts.find((a) => a.id === id);

describe("the method an act signs", () => {
  it("sends the owner's yes and the owner's no to the same write", () => {
    expect(methodOf("agree_substitution")).toBe("answer_substitution");
    expect(methodOf("decline_substitution")).toBe("answer_substitution");
    expect(methodOf("request_cure")).toBe("request_cure");
    expect(methodOf("finalize")).toBe("finalize");
  });
});

describe("proposing a substitute", () => {
  it("is the installer's alone", () => {
    expect(act(actsFor(INSTALLER, milestone()), "propose_substitution")?.available).toBe(true);
    expect(act(actsFor(OWNER, milestone()), "propose_substitution")).toBeUndefined();
    expect(act(actsFor(STRANGER, milestone()), "propose_substitution")).toBeUndefined();
  });

  it("is offered while the work is open, and after a decision that fell short", () => {
    for (const state of ["AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED"] as const) {
      const m = milestone({ state, standing: state === "AWAITING_EVIDENCE" ? null : fellShort() });
      expect(act(actsFor(INSTALLER, m), "propose_substitution")?.available, state).toBe(true);
    }
    for (const state of ["AWAITING_TERMS", "ACCEPTED", "APPEALED", "FINALIZED", "CLOSED"] as const) {
      const a = act(actsFor(INSTALLER, milestone({ state })), "propose_substitution");
      expect(a?.available, state).toBe(false);
      expect(a?.reason).toMatch(/while the work is open/);
    }
  });

  it("closes a minute before the time for the work ends", () => {
    const m = milestone();
    expect(act(actsFor(INSTALLER, m, DEADLINE - MARGIN_MS), "propose_substitution")?.available).toBe(true);
    const late = act(actsFor(INSTALLER, m, DEADLINE - MARGIN_MS + 1), "propose_substitution");
    expect(late?.available).toBe(false);
    expect(late?.reason).toMatch(/time for work on these terms has passed/);
  });

  it("stays open through a cure period that outlasts the deadline", () => {
    const m = rejected({ cure_until: iso(DEADLINE + 600_000) });
    expect(act(actsFor(INSTALLER, m, DEADLINE + 1), "propose_substitution")?.available).toBe(true);
    expect(act(actsFor(INSTALLER, m, DEADLINE + 600_000), "propose_substitution")?.available).toBe(false);
  });

  it("waits for a proposal that is already open", () => {
    for (const status of ["PROPOSED", "CONTESTED"] as const) {
      const a = act(actsFor(INSTALLER, milestone({ substitutions: [proposal({ status })] })),
                    "propose_substitution");
      expect(a?.available).toBe(false);
      expect(a?.reason).toMatch(/already open/);
    }
    const settled = milestone({ substitutions: [proposal({ status: "REFUSED" })] });
    expect(act(actsFor(INSTALLER, settled), "propose_substitution")?.available).toBe(true);
  });

  it("counts proposals against the terms in force only", () => {
    const three = ["S1", "S2", "S3"].map((id) => proposal({ id, status: "WITHDRAWN" }));
    const spent = act(actsFor(INSTALLER, milestone({ substitutions: three })), "propose_substitution");
    expect(spent?.available).toBe(false);
    expect(spent?.reason).toMatch(/every substitution they allow/);
    const older = three.map((s) => ({ ...s, version: 0 }));
    expect(act(actsFor(INSTALLER, milestone({ substitutions: older })), "propose_substitution")?.available)
      .toBe(true);
    expect(act(actsFor(INSTALLER, milestone({ substitutions: three.slice(0, 2) })),
               "propose_substitution")?.available).toBe(true);
  });

  it("needs a schedule to substitute on", () => {
    const a = act(actsFor(INSTALLER, milestone({ schedule: [] })), "propose_substitution");
    expect(a?.available).toBe(false);
    expect(a?.reason).toMatch(/name no equipment/);
  });
});

describe("answering a proposal", () => {
  const open = milestone({ substitutions: [proposal()] });

  it("is the owner's alone, and only while it awaits the owner", () => {
    expect(act(actsFor(OWNER, open), "agree_substitution")?.available).toBe(true);
    expect(act(actsFor(OWNER, open), "decline_substitution")?.available).toBe(true);
    for (const who of [INSTALLER, STRANGER]) {
      expect(act(actsFor(who, open), "agree_substitution")).toBeUndefined();
      expect(act(actsFor(who, open), "decline_substitution")).toBeUndefined();
    }
    const contested = milestone({ substitutions: [proposal({ status: "CONTESTED" })] });
    expect(act(actsFor(OWNER, contested), "agree_substitution")).toBeUndefined();
    expect(act(actsFor(OWNER, milestone()), "agree_substitution")).toBeUndefined();
  });

  it("closes a minute before the window does", () => {
    const by = NOW + 540_000;
    expect(act(actsFor(OWNER, open, by - MARGIN_MS), "agree_substitution")?.available).toBe(true);
    for (const id of ["agree_substitution", "decline_substitution"]) {
      const a = act(actsFor(OWNER, open, by - MARGIN_MS + 1), id);
      expect(a?.available).toBe(false);
      expect(a?.reason).toMatch(/time to answer has passed/);
    }
  });

  it("tells the owner what a no will do on each kind of line", () => {
    expect(act(actsFor(OWNER, open), "decline_substitution")?.reason).toMatch(/validators decide whether it is one/);
    const plain = milestone({ substitutions: [proposal({ or_equivalent: false })] });
    expect(act(actsFor(OWNER, plain), "decline_substitution")?.reason).toMatch(/your no ends the matter/);
  });
});

describe("withdrawing and deciding a proposal", () => {
  it("lets the installer take back whatever is open", () => {
    for (const status of ["PROPOSED", "CONTESTED"] as const) {
      const m = milestone({ substitutions: [proposal({ status })] });
      expect(act(actsFor(INSTALLER, m), "withdraw_substitution")?.available).toBe(true);
      expect(act(actsFor(OWNER, m), "withdraw_substitution")).toBeUndefined();
    }
    expect(act(actsFor(INSTALLER, milestone()), "withdraw_substitution")).toBeUndefined();
    const done = milestone({ substitutions: [proposal({ status: "AGREED" })] });
    expect(act(actsFor(INSTALLER, done), "withdraw_substitution")).toBeUndefined();
  });

  it("lets anyone put an or-equivalent line to the validators at once", () => {
    for (const status of ["PROPOSED", "CONTESTED"] as const) {
      const m = milestone({ substitutions: [proposal({ status })] });
      for (const who of [OWNER, INSTALLER, STRANGER, ""]) {
        const a = act(actsFor(who, m), "decide_substitution");
        expect(a?.available, `${status} ${who}`).toBe(true);
        expect(a?.reason).toMatch(/validators each read the product page/);
      }
    }
  });

  it("waits out the owner's window, to the instant, on a line signed for one product", () => {
    const m = milestone({ substitutions: [proposal({ or_equivalent: false })] });
    const by = NOW + 540_000;
    const waiting = act(actsFor(STRANGER, m, by), "decide_substitution");
    expect(waiting?.available).toBe(false);
    expect(waiting?.reason).toMatch(/owner may still answer/);
    expect(act(actsFor(STRANGER, m, by + 1), "decide_substitution")?.available).toBe(true);
  });

  it("says that silence on a line with no or-equivalent only closes the proposal", () => {
    const m = milestone({ substitutions: [proposal({ or_equivalent: false })] });
    const a = act(actsFor(STRANGER, m, NOW + 540_001), "decide_substitution");
    expect(a?.available).toBe(true);
    expect(a?.reason).toMatch(/line stays as signed/);
  });

  it("offers nothing to decide when nothing is open", () => {
    expect(act(actsFor(STRANGER, milestone()), "decide_substitution")).toBeUndefined();
    const done = milestone({ substitutions: [proposal({ status: "LAPSED" })] });
    expect(act(actsFor(STRANGER, done), "decide_substitution")).toBeUndefined();
    expect(openSubstitution(done)).toBeNull();
  });
});

describe("nothing is judged while a proposal is open", () => {
  const sub = [proposal()];

  it("holds back a full assessment", () => {
    const a = act(actsFor(INSTALLER, milestone({ substitutions: sub })), "request_assessment");
    expect(a?.available).toBe(false);
    expect(a?.reason).toMatch(/proposed substitute is open/);
  });

  it("holds back a cure round", () => {
    const m = rejected({ substitutions: sub, evidence: { "1": [item(1), item(2), item(3)] } });
    const a = act(actsFor(INSTALLER, m), "request_cure");
    expect(a?.available).toBe(false);
    expect(a?.reason).toMatch(/proposed substitute is open/);
  });

  it("holds back the installer's appeal", () => {
    const a = act(actsFor(INSTALLER, rejected({ substitutions: sub })), "open_appeal");
    expect(a?.available).toBe(false);
    expect(a?.reason).toMatch(/proposed substitute is open/);
    expect(act(actsFor(INSTALLER, rejected()), "open_appeal")?.available).toBe(true);
  });

  it("sends a decision about another schedule to a cure round, not an appeal", () => {
    const acts = milestoneActs({ project, milestone: rejected(), addr: INSTALLER, config,
                                 nowMs: NOW, scheduleChanged: true });
    const a = act(acts, "open_appeal");
    expect(a?.available).toBe(false);
    expect(a?.reason).toMatch(/Ask for a cure round instead/);
  });
});

describe("the cure round", () => {
  const withNew = (over: Partial<Milestone> = {}) =>
    rejected({ evidence: { "1": [item(1), item(2), item(3)] }, ...over });

  it("is the installer's, and only after a decision that fell short", () => {
    expect(act(actsFor(INSTALLER, withNew()), "request_cure")?.available).toBe(true);
    expect(act(actsFor(INSTALLER, withNew({ state: "UNDETERMINED" })), "request_cure")?.available).toBe(true);
    expect(act(actsFor(OWNER, withNew()), "request_cure")).toBeUndefined();
    for (const state of ["AWAITING_EVIDENCE", "ACCEPTED", "APPEALED", "FINALIZED", "CLOSED"] as const) {
      expect(act(actsFor(INSTALLER, withNew({ state })), "request_cure"), state).toBeUndefined();
    }
  });

  it("needs something the installer filed since the decision", () => {
    const a = act(actsFor(INSTALLER, rejected()), "request_cure");
    expect(a?.available).toBe(false);
    expect(a?.reason).toMatch(/filed since the decision/);
    const theirs = rejected({ evidence: { "1": [item(1), item(2), item(3, { role: "OWNER" })] } });
    expect(act(actsFor(INSTALLER, theirs), "request_cure")?.available).toBe(false);
    const said = rejected({ evidence: { "1": [item(1), item(2), item(3, { kind: "DECLARATION" })] } });
    expect(act(actsFor(INSTALLER, said), "request_cure")?.available).toBe(false);
    expect(filedSince(withNew()).map((it) => it.item_id)).toEqual(["ev-000003"]);
  });

  it("counts an item held back from the decision as old, not new", () => {
    const held = rejected({ standing: fellShort({ item_mark: 3 }),
                            evidence: { "1": [item(1), item(2), item(3)] } });
    expect(act(actsFor(INSTALLER, held), "request_cure")?.available).toBe(false);
  });

  it("is withheld when the decision found conflict or lapsed on appeal", () => {
    const conflict = act(actsFor(INSTALLER, withNew(), NOW, true), "request_cure");
    expect(conflict?.available).toBe(false);
    expect(conflict?.reason).toMatch(/evidence in conflict/);
    const lapsed = withNew({ state: "UNDETERMINED", standing: fellShort({
      decision: "UNDETERMINED", kind: "APPEAL_LAPSED", appealable: false, appealed: true,
      window_ends: null }) });
    const a = act(actsFor(INSTALLER, lapsed), "request_cure");
    expect(a?.available).toBe(false);
    expect(a?.reason).toMatch(/never confirmed on appeal/);
  });

  it("shares the allowance of assessments", () => {
    expect(act(actsFor(INSTALLER, withNew({ version_assessments: 4 })), "request_cure")?.available).toBe(true);
    const a = act(actsFor(INSTALLER, withNew({ version_assessments: 5 })), "request_cure");
    expect(a?.available).toBe(false);
    expect(a?.reason).toMatch(/every assessment they allow/);
  });

  it("is heard past the deadline for as long as the cure period runs", () => {
    const m = withNew({ cure_until: iso(DEADLINE + 600_000) });
    expect(workEndsMs(m, iso(DEADLINE))).toBe(DEADLINE + 600_000);
    expect(act(actsFor(INSTALLER, m, DEADLINE + 1), "request_cure")?.available).toBe(true);
    expect(act(actsFor(INSTALLER, m, DEADLINE + 1), "submit_image")?.available).toBe(true);
    const full = act(actsFor(INSTALLER, m, DEADLINE + 1), "request_assessment");
    expect(full?.available).toBe(false);
    expect(full?.reason).toMatch(/full assessment is no longer heard/);
    const late = DEADLINE + 600_000 - MARGIN_MS + 1;
    expect(act(actsFor(INSTALLER, m, late), "request_cure")?.available).toBe(false);
    expect(act(actsFor(INSTALLER, m, late), "request_cure")?.reason).toMatch(/has passed/);
    expect(act(actsFor(INSTALLER, m, late), "submit_image")?.available).toBe(false);
  });

  it("ends at the deadline when no cure period outlasts it", () => {
    const m = withNew({ cure_until: null });
    expect(workEndsMs(m, iso(DEADLINE))).toBe(DEADLINE);
    expect(act(actsFor(INSTALLER, m, DEADLINE - MARGIN_MS + 1), "request_cure")?.available).toBe(false);
    expect(workEndsMs(withNew({ cure_until: iso(NOW) }), iso(DEADLINE))).toBe(DEADLINE);
  });
});

describe("closing waits for the cure period", () => {
  it("is held while a decision that fell short can still be put right", () => {
    const m = rejected({ standing: fellShort({ appealable: false, window_ends: null,
                                               decision: "UNDETERMINED" }),
                         state: "UNDETERMINED", cure_until: iso(DEADLINE + 600_000) });
    const held = act(actsFor(STRANGER, m, DEADLINE + 600_000), "close_milestone");
    expect(held?.available).toBe(false);
    expect(held?.reason).toMatch(/can still be put right/);
    expect(act(actsFor(STRANGER, m, DEADLINE + 600_001), "close_milestone")?.available).toBe(true);
  });

  it("closes at the deadline when nothing is left to cure", () => {
    const m = milestone({ state: "UNDETERMINED", cure_until: null,
                          standing: fellShort({ appealable: false, window_ends: null }) });
    expect(act(actsFor(STRANGER, m, DEADLINE), "close_milestone")?.available).toBe(false);
    expect(act(actsFor(STRANGER, m, DEADLINE + 1), "close_milestone")?.available).toBe(true);
  });
});

describe("a proposal checked at the form", () => {
  const draft = { line: LINE, manufacturer: "Growatt", model: "MOD 4000TL3-X", rating: "4 kW",
                  page: "https://www.example-seller.com/mod-4000tl3-x", reason: "Out of stock." };

  it("passes what the contract would take", () => {
    expect(proposalProblem(draft)).toBe("");
    expect(proposalProblem({ ...draft, line: { ...LINE, rating: "" }, rating: "" })).toBe("");
  });

  it.each([
    [{ line: null }, /Choose the line/],
    [{ manufacturer: " " }, /maker and model/],
    [{ model: "" }, /maker and model/],
    [{ model: "S-5" }, /at least 4 letters or digits/],
    [{ rating: " " }, /State the substitute's rating/],
    [{ page: "http://www.example-seller.com/x" }, /plain https link/],
    [{ page: "https://www.example-seller.com/a b" }, /plain https link/],
    [{ page: "https://www.example-seller.com/>>>" }, /plain https link/],
    [{ page: `https://www.example-seller.com/${"a".repeat(300)}` }, /plain https link/],
    [{ reason: "" }, /Say why/],
  ])("stops %j", (over, why) => {
    expect(proposalProblem({ ...draft, ...over })).toMatch(why);
  });
});

describe("what one round reads from the installer", () => {
  it("counts photographs and documents apart", () => {
    const four = [1, 2, 3, 4].map((n) => item(n));
    expect(withinCaps(four, { IMAGE: 4, TEXT: 4 })).toEqual({ ok: true, images: 4, texts: 0 });
    expect(withinCaps([...four, item(5)], { IMAGE: 4, TEXT: 4 }).ok).toBe(false);
    const docs = [1, 2, 3, 4, 5].map((n) => item(n, { kind: "DOCUMENT" }));
    expect(withinCaps(docs, { IMAGE: 4, TEXT: 4 })).toEqual({ ok: false, images: 0, texts: 5 });
    expect(withinCaps([...four, ...docs.slice(0, 4)], { IMAGE: 4, TEXT: 4 }).ok).toBe(true);
  });
});

describe("the words for it", () => {
  it("has a heading and a sentence for every state a proposal can be in", () => {
    for (const s of ["PROPOSED", "CONTESTED", "AGREED", "APPROVED", "DECLINED", "REFUSED",
                     "WITHDRAWN", "LAPSED", "VOID"]) {
      expect(substitutionStatus(s), s).not.toMatch(/[A-Z]{3}|_/);
      expect(substitutionSaid(s).length, s).toBeGreaterThan(40);
      expect(eventKind(`SUBSTITUTION_${s}`), s).not.toMatch(/Substitution /);
    }
    expect(substitutionSaid("SOMETHING_ELSE")).toBe("");
  });

  it("says why validators did or did not approve, and nothing for no verdict", () => {
    for (const v of ["EQUIVALENT", "NOT_EQUIVALENT", "UNPROVEN"]) {
      expect(verdictSaid(v).length).toBeGreaterThan(60);
    }
    expect(verdictSaid(null)).toBe("");
  });

  it("writes findings and round kinds out", () => {
    expect(publisher("DISTRIBUTOR")).toBe("A seller's catalogue");
    expect(publisher("UNKNOWN")).toMatch(/No publisher/);
    expect(meets("NO")).toMatch(/Falls short/);
    expect(roundKind("CURE")).toBe("Cure round");
  });

  it("names a product and the site a page sits on", () => {
    expect(productName({ manufacturer: "Growatt", model: "MOD 4000TL3-X", rating: "4 kW" }))
      .toBe("Growatt MOD 4000TL3-X, 4 kW");
    expect(productName({ manufacturer: "Kripal", model: "DC isolator", rating: "" }))
      .toBe("Kripal DC isolator");
    expect(siteOf("https://www.example-seller.com/en/product/x?y=1")).toBe("example-seller.com");
    expect(siteOf("not a link")).toBe("");
  });
});
