/**
 * What each person can do next, decided as a pure function of the record,
 * the viewer's address and the chain's own clock, mirroring the contract's
 * checks. An act the contract would refuse is never a button that fails: it
 * is listed with the reason, in words.
 *
 * Acts that must land BEFORE a boundary close a minute early, because a
 * transaction signed at the last second executes after it: a round takes the
 * better part of a minute to finalize on this network, and a button that is
 * live until the instant a window shuts is a button that lies.
 */
import type {
  Config, EvidenceItem, Milestone, MilestoneSummary, Project, Role,
} from "./types";

export const MARGIN_MS = 60_000;

export type ActId =
  | "accept_project" | "accept_inspector_role" | "fund_project" | "withdraw_escrow"
  | "cancel_project" | "add_milestone"
  | "propose_version" | "accept_version"
  | "submit_image" | "submit_document" | "submit_declaration"
  | "request_assessment" | "open_appeal" | "decide_appeal" | "lapse_appeal"
  | "finalize" | "close_milestone" | "claim";

export interface Act {
  id: ActId;
  available: boolean;
  /** Why it is unavailable, or what it will do. Always a sentence. */
  reason: string;
}

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);
const same = (a: string, b: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function roleIn(p: Project, addr: string): Role | null {
  if (same(addr, p.owner)) return "OWNER";
  if (same(addr, p.installer)) return "INSTALLER";
  if (p.inspector && same(addr, p.inspector)) return "INSPECTOR";
  return null;
}

const ok = (id: ActId, reason: string): Act => ({ id, available: true, reason });
const no = (id: ActId, reason: string): Act => ({ id, available: false, reason });

/* ── the project ────────────────────────────────────────────────────────── */

export function projectActs(p: Project, addr: string): Act[] {
  const who = roleIn(p, addr);
  const acts: Act[] = [];

  if (who === "INSTALLER") {
    acts.push(
      p.state === "PROPOSED"
        ? ok("accept_project", "Sign the project and every milestone's terms proposed so far.")
        : no(
            "accept_project",
            p.state === "ACTIVE" ? "You signed this project." : "The project was cancelled.",
          ),
    );
  }

  if (who === "INSPECTOR") {
    acts.push(
      p.inspector_accepted_at
        ? no("accept_inspector_role", "You accepted the inspector role.")
        : p.state === "CANCELLED"
          ? no("accept_inspector_role", "The project was cancelled.")
          : ok("accept_inspector_role", "Accept the role so you can file inspection evidence."),
    );
  }

  if (who === "OWNER") {
    const unreserved = BigInt(p.unreserved_wei);
    acts.push(
      p.state === "CANCELLED"
        ? no("fund_project", "The project was cancelled.")
        : ok("fund_project", "Add to the escrow this project pays its milestones from."),
    );
    acts.push(
      unreserved > 0n
        ? ok("withdraw_escrow", "Take back escrow no milestone has reserved.")
        : no("withdraw_escrow", "Every funded amount is reserved against a milestone."),
    );
    acts.push(
      p.state === "CANCELLED"
        ? no("cancel_project", "The project was already cancelled.")
        : p.milestone_summaries.some((m) => m.state === "FINALIZED")
          ? no("cancel_project", "A milestone has already settled, so the project stands.")
          : ok("cancel_project", "Close the project and release what it holds."),
    );
    acts.push(
      p.state === "CANCELLED"
        ? no("add_milestone", "The project was cancelled.")
        : ok("add_milestone", "Propose a milestone with its equipment schedule."),
    );
  }

  return acts;
}

/* ── one milestone ──────────────────────────────────────────────────────── */

export interface MilestoneActsInput {
  project: Project;
  milestone: Milestone;
  addr: string;
  config: Config | null;
  /** The chain's clock from the read that produced this record. */
  nowMs: number;
}

export function milestoneActs({
  project: p,
  milestone: m,
  addr,
  config,
  nowMs,
}: MilestoneActsInput): Act[] {
  const who = roleIn(p, addr);
  const acts: Act[] = [];
  const terms = m.versions.find((v) => v.version === m.current_version) ?? null;
  const deadlinePassed = !!terms && nowMs > ms(terms.deadline) - MARGIN_MS;
  const standing = m.standing;

  /*
   * Terms are asymmetric, and the contract is explicit about it: the owner
   * proposes a schedule and the installer signs it. Offering either act to
   * the other party would be a button that always fails.
   */
  if (who === "OWNER") {
    acts.push(
      m.state === "CLOSED" || m.state === "FINALIZED"
        ? no("propose_version", "This milestone is finished, so its terms cannot change.")
        : m.state === "ACCEPTED" || m.state === "APPEALED"
          ? no("propose_version", "New terms cannot replace a decision that stands.")
          : config && m.versions.length >= config.max_versions_per_milestone
            ? no("propose_version", "These terms have been revised as often as the contract allows.")
            : ok("propose_version", "Propose a new schedule; it binds only once the installer signs."),
    );
  }

  if (who === "INSTALLER") {
    const pending = m.pending_version !== null;
    acts.push(
      pending
        ? ok("accept_version", "Sign the terms the owner proposed. They bind when you do.")
        : no("accept_version", "There are no proposed terms waiting on your signature."),
    );
  }

  /*
   * Evidence closes on a settled milestone and on a standing acceptance, and
   * nowhere else. A rejection or an undetermined finding is precisely where
   * an installer files more and asks again, so withholding it there would
   * shut the door on the recovery path the contract is built around.
   */
  if (who) {
    const filing =
      m.state === "FINALIZED" || m.state === "CLOSED"
        ? no("submit_image", "This milestone has settled, so its record is closed.")
        : m.state === "ACCEPTED"
          ? no("submit_image", "An acceptance stands. To contest it, open an appeal; every party may then file.")
          : m.state === "AWAITING_TERMS"
            ? no("submit_image", "The terms are not signed yet, so there is nothing to file against.")
            : p.state !== "ACTIVE"
              ? no("submit_image", "Evidence is filed once the installer has signed the project.")
              : who === "INSPECTOR" && !p.inspector_accepted_at
                ? no("submit_image", "Accept the inspector role first.")
                : m.state === "APPEALED"
                  ? ok("submit_image", "File a photograph the appeal will read, within its evidence period.")
                  : deadlinePassed
                    ? no("submit_image", "The deadline has passed, so nothing further can be filed.")
                    : ok("submit_image", "File a photograph; its bytes are held and hashed by the contract.");
    acts.push(filing);
    acts.push({
      ...filing,
      id: "submit_document",
      reason: filing.available
        ? "File a document. A document states what was specified; it never shows what was installed."
        : filing.reason,
    });
    acts.push({
      ...filing,
      id: "submit_declaration",
      reason: filing.available
        ? "Record a statement for the file. A declaration is never read by the panel."
        : filing.reason,
    });
  }

  /*
   * Only the installer asks for an assessment, and they may ask again after a
   * rejection or an undetermined finding, up to the cap the terms allow.
   */
  if (who === "INSTALLER") {
    const used = m.version_assessments;
    const cap = config?.max_assessments_per_version ?? Infinity;
    acts.push(
      m.state === "FINALIZED" || m.state === "CLOSED"
        ? no("request_assessment", "This milestone has settled.")
        : m.state === "ACCEPTED"
          ? no("request_assessment", "An acceptance already stands on this milestone.")
          : m.state === "APPEALED"
            ? no("request_assessment", "An appeal is open; it is decided by readjudication.")
            : m.state === "AWAITING_TERMS"
              ? no("request_assessment", "The terms are not signed yet.")
              : deadlinePassed
                ? no("request_assessment", "The deadline has passed; this milestone can only be closed.")
                : used >= cap
                  ? no("request_assessment", "These terms have had every assessment they allow.")
                  : ok("request_assessment", "Ask a panel to read the evidence against the schedule."),
    );
  }

  /* appeal */
  if (who === "OWNER") {
    const windowOpen =
      !!standing?.appealable && !standing.appealed && nowMs < ms(standing.window_ends) - MARGIN_MS;
    acts.push(
      m.state === "APPEALED"
        ? no("open_appeal", "An appeal is already open on this milestone.")
        : !standing?.appealable
          ? no("open_appeal", "There is no decision on this milestone to contest.")
          : standing.appealed
            ? no("open_appeal", "This decision has already been contested once.")
            : windowOpen
              ? ok("open_appeal", "Contest the decision and have a fresh panel judge it again.")
              : no("open_appeal", "The window for contesting this decision has closed."),
    );
  }

  /* readjudication and its exit: both permissionless */
  if (m.state === "APPEALED" && m.appeal) {
    const evidenceClosed = nowMs > ms(m.appeal.evidence_ends);
    acts.push(
      evidenceClosed
        ? ok("decide_appeal", "Ask a fresh panel to judge the milestone again.")
        : no("decide_appeal", "The appeal is still taking evidence."),
    );
    const lapsesAt = ms(m.appeal.evidence_ends) + (config?.appeal_lapse_seconds ?? 0) * 1000;
    acts.push(
      nowMs > lapsesAt
        ? ok("lapse_appeal", "No panel decided this appeal in time; close it and pay nothing.")
        : no("lapse_appeal", "An appeal lapses three days after its evidence period ends."),
    );
  }

  /* settlement: permissionless, because a payment should not wait on goodwill */
  const settles =
    standing?.decision === "ACCEPTED" &&
    (m.state === "ACCEPTED" || m.state === "APPEALED") &&
    (standing.appealed || nowMs > ms(standing.window_ends));
  acts.push(
    m.state === "FINALIZED"
      ? no("finalize", "This milestone has settled.")
      : standing?.decision !== "ACCEPTED"
        ? no("finalize", "Nothing pays until a panel accepts the milestone.")
        : settles
          ? ok("finalize", "Settle the milestone; the payment becomes a claim the installer draws.")
          : no("finalize", "The window for contesting this acceptance has not closed."),
  );

  /*
   * Closing is permissionless too, and it has real conditions: the deadline
   * must have passed and any standing appeal window must have closed. An
   * earlier version of this offered it to the owner alone and ignored both,
   * which was wrong twice over: it withheld an act the contract allows, and
   * it offered one the contract would refuse.
   */
  const closeBlocked =
    m.state === "FINALIZED" || m.state === "CLOSED"
      ? "This milestone has already settled."
      : m.state === "ACCEPTED"
        ? "An acceptance stands, so this is settled rather than closed."
        : m.state === "APPEALED"
          ? "An appeal is open. Decide it, or let it lapse."
          : !terms
            ? "There are no terms in force to close against."
            : nowMs <= ms(terms.deadline)
              ? "The deadline has not passed."
              : standing?.appealable && standing.window_ends && nowMs <= ms(standing.window_ends)
                ? "A decision can still be contested."
                : null;
  acts.push(
    closeBlocked
      ? no("close_milestone", closeBlocked)
      : ok("close_milestone", "Close it, and release what it reserved to the owner's escrow."),
  );

  return acts;
}

/**
 * The milestone the cover features as a worked example: one that was decided,
 * contested and settled, so a reader sees the whole path rather than a
 * fragment of it. Falls back to the most decided milestone available.
 */
export function workedExample(p: Project | null): MilestoneSummary | null {
  if (!p) return null;
  const rank = (m: MilestoneSummary) =>
    (m.state === "FINALIZED" ? 4 : 0) +
    (m.standing?.appealed ? 2 : 0) +
    (m.rounds_count > 0 ? 1 : 0);
  const best = [...p.milestone_summaries].sort((a, b) => rank(b) - rank(a))[0];
  return best && rank(best) > 0 ? best : null;
}

/** Items filed against the terms currently in force, newest first. */
export function currentEvidence(m: Milestone): EvidenceItem[] {
  const rows = m.evidence[String(m.current_version)] ?? [];
  return [...rows].sort((a, b) => b.item_id.localeCompare(a.item_id));
}
