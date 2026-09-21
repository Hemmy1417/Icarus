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

  /*
   * Anyone may add escrow to a project; only the owner takes it back. A
   * third party underwriting the work is a thing the contract allows, so the
   * interface does not quietly forbid it.
   */
  if (addr) {
    acts.push(
      p.state === "CANCELLED"
        ? no("fund_project", "This project was cancelled.")
        : ok("fund_project", "Add to the escrow this project pays its milestones from."),
    );
  }

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
      unreserved > 0n
        ? ok("withdraw_escrow", "Take back escrow no milestone has reserved.")
        : no("withdraw_escrow", "Every funded amount is reserved against a milestone."),
    );
    /*
     * Cancelling is only open before the installer signs. Once they have,
     * the project stands and its milestones are closed one at a time: the
     * owner cannot unwind an agreement the other party has entered.
     */
    acts.push(
      p.state === "CANCELLED"
        ? no("cancel_project", "This project was already cancelled.")
        : p.state !== "PROPOSED"
          ? no(
              "cancel_project",
              "The installer has signed, so this stands. Close its milestones instead.",
            )
          : ok("cancel_project", "Cancel it, before the installer has signed, and take the escrow back."),
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

  /*
   * A decision is contested by the party it went against: an acceptance by
   * the owner, a rejection by the installer. Offering it to the owner alone
   * left an installer with a wrongly rejected milestone no recourse at all,
   * which is the party the appeal exists to protect.
   */
  const contestedBy: Role | null =
    standing?.decision === "ACCEPTED" ? "OWNER"
      : standing?.decision === "REJECTED" ? "INSTALLER"
        : null;

  if (who && (who === contestedBy || (!contestedBy && who !== "INSPECTOR"))) {
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
              ? ok(
                  "open_appeal",
                  standing.decision === "ACCEPTED"
                    ? "Contest the acceptance; a fresh panel judges the case again."
                    : "Contest the rejection; a fresh panel judges the case again.",
                )
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

  /*
   * Settlement: permissionless, because a payment should not wait on goodwill.
   *
   * This mirrors the contract's finalize() line for line, and an earlier
   * version did not. It read `standing.appealed` as "an appeal upheld this".
   * The contract sets that flag when an appeal OPENS and never anywhere else:
   * a decided appeal writes a fresh standing of kind APPEAL with the flag
   * false and no window at all. So the old rule offered to settle an
   * acceptance while its appeal was still open (the contract refuses: the
   * state is APPEALED, not ACCEPTED), and then, once an appeal had upheld the
   * acceptance, compared the clock against a window that does not exist and
   * never offered to settle it. The payment the appeal had just confirmed
   * could not be reached from the interface.
   *
   *   state is ACCEPTED, and the standing is not appealable  -> settle now
   *   state is ACCEPTED, appealable, window has passed       -> settle now
   *   state is ACCEPTED, appealable, window still open       -> wait
   *   state is APPEALED                                      -> an appeal decides first
   */
  const windowOpen =
    !!standing?.appealable && !!standing.window_ends && nowMs <= ms(standing.window_ends);
  acts.push(
    m.state === "FINALIZED"
      ? no("finalize", "This milestone has settled.")
      : m.state === "APPEALED"
        ? no("finalize", "An appeal is open. Nothing settles until a fresh panel decides it.")
        : m.state !== "ACCEPTED"
          ? no("finalize", "Nothing pays until a panel accepts the milestone.")
          : windowOpen
            ? no("finalize", "The window for contesting this acceptance has not closed.")
            : ok("finalize", "Settle the milestone; the payment becomes a claim the installer draws."),
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
 * Where a milestone stands with respect to an appeal, read the way the
 * contract writes it. `standing.appealed` alone cannot answer this: it is
 * true while an appeal is open and after one lapses, and false after one is
 * decided, which is the opposite of what the name suggests.
 *
 *   OPEN     state APPEALED: filed, not yet decided
 *   DECIDED  the standing decision came from an appeal round, and is final
 *   LAPSED   no panel decided it in time; the milestone is undetermined
 *   NONE     nothing on this milestone was ever contested to a conclusion
 */
export type AppealStanding = "NONE" | "OPEN" | "DECIDED" | "LAPSED";

export function appealStanding(
  m: Pick<MilestoneSummary, "state" | "standing">,
): AppealStanding {
  if (m.state === "APPEALED") return "OPEN";
  if (m.standing?.kind === "APPEAL") return "DECIDED";
  if (m.standing?.kind === "APPEAL_LAPSED") return "LAPSED";
  return "NONE";
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
    (appealStanding(m) === "DECIDED" ? 2 : 0) +
    (m.rounds_count > 0 ? 1 : 0);
  const best = [...p.milestone_summaries].sort((a, b) => rank(b) - rank(a))[0];
  return best && rank(best) > 0 ? best : null;
}

/** Items filed against the terms currently in force, newest first. */
export function currentEvidence(m: Milestone): EvidenceItem[] {
  const rows = m.evidence[String(m.current_version)] ?? [];
  return [...rows].sort((a, b) => b.item_id.localeCompare(a.item_id));
}
