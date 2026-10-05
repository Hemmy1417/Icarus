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
  Config, EvidenceItem, Milestone, MilestoneSummary, Project, Role, Substitution,
} from "./types";

export const MARGIN_MS = 60_000;

export type ActId =
  | "accept_project" | "accept_inspector_role" | "fund_project" | "withdraw_escrow"
  | "cancel_project" | "add_milestone"
  | "propose_version" | "accept_version"
  | "submit_image" | "submit_document" | "submit_declaration"
  | "request_assessment" | "request_cure"
  | "propose_substitution" | "agree_substitution" | "decline_substitution"
  | "withdraw_substitution" | "decide_substitution"
  | "open_appeal" | "decide_appeal" | "lapse_appeal"
  | "finalize" | "close_milestone" | "claim";

/**
 * The contract method each act signs. Two acts share one: the owner's yes
 * and the owner's no are the same write with a different answer in it, and
 * a person should be offered the two as the two different things they are.
 */
export function methodOf(id: ActId): string {
  return id === "agree_substitution" || id === "decline_substitution" ? "answer_substitution" : id;
}

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
  /**
   * Whether the standing decision found the evidence in conflict. A cure is
   * offered either way; this only changes what the person is told it will
   * do, since a decision in conflict keeps nothing.
   */
  standingConflict?: boolean;
  /** Whether a substitute has come into force since the standing decision. */
  scheduleChanged?: boolean;
}

/** The proposal still waiting on an answer or a decision, if there is one. */
export function openSubstitution(m: Pick<Milestone, "substitutions">): Substitution | null {
  return m.substitutions.find((s) => s.status === "PROPOSED" || s.status === "CONTESTED") ?? null;
}

/**
 * When work on the signed terms stops being heard: the deadline, or the end
 * of the cure period a decision that fell short opened, whichever is later.
 * Mirrors the contract's _work_ends().
 */
export function workEndsMs(m: Pick<Milestone, "cure_until">, deadline: string): number {
  const end = ms(deadline);
  const cure = ms(m.cure_until);
  return Number.isNaN(cure) ? end : Math.max(end, cure);
}

/** The installer's items filed since the standing decision, which a cure may rest on. */
export function filedSince(m: Milestone): EvidenceItem[] {
  const mark = m.standing?.item_mark ?? 0;
  return (m.evidence[String(m.current_version)] ?? []).filter(
    (it) => it.role === "INSTALLER" && it.kind !== "DECLARATION"
      && Number(it.item_id.split("-")[1]) > mark,
  );
}

export function milestoneActs({
  project: p,
  milestone: m,
  addr,
  config,
  nowMs,
  standingConflict = false,
  scheduleChanged = false,
}: MilestoneActsInput): Act[] {
  const who = roleIn(p, addr);
  const acts: Act[] = [];
  const terms = m.versions.find((v) => v.version === m.current_version) ?? null;
  const deadlinePassed = !!terms && nowMs > ms(terms.deadline) - MARGIN_MS;
  /* Past the deadline, work is still heard while a cure period runs. */
  const workPassed = !!terms && nowMs > workEndsMs(m, terms.deadline) - MARGIN_MS;
  const standing = m.standing;
  const open = openSubstitution(m);
  const workOpen =
    m.state === "AWAITING_EVIDENCE" || m.state === "REJECTED" || m.state === "UNDETERMINED";

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
                  : workPassed
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
                ? no("request_assessment", "The deadline has passed, so a full assessment is no longer heard.")
                : open
                  ? no("request_assessment", "A proposed substitute is open. It is settled or withdrawn before the evidence is judged.")
                  : used >= cap
                    ? no("request_assessment", "These terms have had every assessment they allow.")
                    : ok("request_assessment", "Ask a panel to read the evidence against the schedule."),
    );

    /*
     * The cure round: what a decision that fell short leaves the installer
     * able to put right. It is offered only where the contract would hear
     * it, and each reason it is withheld is the contract's own.
     */
    if (m.state === "REJECTED" || m.state === "UNDETERMINED") {
      acts.push(
        standing?.kind === "APPEAL_LAPSED"
          ? no("request_cure", "The last decision was never confirmed on appeal, so nothing in it can be carried forward.")
          : workPassed
            ? no("request_cure", "The time for putting this decision right has passed.")
            : open
              ? no("request_cure", "A proposed substitute is open. It is settled or withdrawn before the evidence is judged.")
              : used >= cap
                ? no("request_cure", "These terms have had every assessment they allow.")
                : !filedSince(m).length
                  ? no("request_cure", "File what puts it right first. A cure rests on something filed since the decision.")
                  : standingConflict
                    ? ok("request_cure", "The last decision found the evidence in conflict, so nothing in it is kept. A panel judges every line again on what you present.")
                    : ok("request_cure", "Have a panel judge only what the last decision left open. What it found in place is kept."),
      );
    }

    /* A substitute for one line of the schedule: the installer asks. */
    const proposed = m.substitutions.filter((s) => s.version === m.current_version).length;
    const allowance = config?.max_substitutions_per_version ?? Infinity;
    acts.push(
      !workOpen
        ? no("propose_substitution", "A substitute is proposed while the work is open: on signed terms, with no acceptance standing and no appeal under way.")
        : workPassed
          ? no("propose_substitution", "The time for work on these terms has passed.")
          : open
            ? no("propose_substitution", "A proposal is already open on this milestone.")
            : used >= cap
              ? no("propose_substitution", "These terms have no round left to judge a substitute.")
                : proposed >= allowance
                ? no("propose_substitution", "These terms have had every substitution they allow.")
                : !m.schedule.length
                  ? no("propose_substitution", "These terms name no equipment to substitute.")
                  : ok("propose_substitution", "Ask to fit a different product on one line, and name a page that documents it."),
    );
    if (open) {
      acts.push(ok("withdraw_substitution", "Take your proposal back. The line stays as it is, and the evidence can be judged again."));
    }
  }

  /*
   * The owner answers a proposal, inside the project's window. An owner who
   * objected may still come round to a yes while the question is open; a
   * second no would add nothing, so it is not offered.
   */
  if (who === "OWNER" && open) {
    const late = nowMs > ms(open.respond_by) - MARGIN_MS;
    acts.push(
      late
        ? no("agree_substitution", "The time to answer has passed.")
        : ok("agree_substitution", "Agree to it. The substitute becomes the product the evidence is judged against."),
    );
  }
  if (who === "OWNER" && open?.status === "PROPOSED") {
    const late = nowMs > ms(open.respond_by) - MARGIN_MS;
    acts.push(
      late
        ? no("decline_substitution", "The time to answer has passed.")
        : ok(
            "decline_substitution",
            open.or_equivalent
              ? "Object to it. The line was signed with or equivalent, so the validators decide whether it is one, and your objection is put before them."
              : "Decline it. The line was signed for one product, so your no ends the matter.",
          ),
    );
  }

  /*
   * Settling a proposal the parties did not settle between them is
   * permissionless: nobody should have to wait on the other side's goodwill.
   */
  if (open) {
    /*
     * On a line signed with or equivalent the validators may be asked as
     * soon as the owner has objected, and otherwise after a short objection
     * period: long enough that an objection can always be put before them,
     * short enough that silence cannot run out the installer's time. On any
     * other line only the owner's yes changes it, so there is nothing to
     * decide until the owner's window has passed.
     */
    acts.push(
      open.or_equivalent
        ? open.status === "PROPOSED" && nowMs <= ms(open.decide_from)
          ? no("decide_substitution", "The owner may still object. The validators are asked once the owner has, or once the objection period has passed.")
          : ok("decide_substitution", "Have the validators each read the product page and decide whether it is an equivalent.")
        : nowMs <= ms(open.respond_by)
          ? no("decide_substitution", "This line was signed for one product, so only the owner's yes can change it. The owner may still answer.")
          : ok("decide_substitution", "The owner did not answer and the line allows no equivalent. Close the proposal; the line stays as signed."),
    );
  }

  /*
   * A decision is contested by the party it went against: an acceptance by
   * the owner, a rejection by the installer. Offering it to the owner alone
   * left an installer with a wrongly rejected milestone no recourse at all,
   * which is the party the appeal exists to protect.
   */
  /*
   * A decision about one schedule is not appealed against another: once a
   * substitute has come into force since the decision, the way on is a cure
   * round, whose own decision can be contested. The round's record says what
   * it judged; a caller that has not read it leaves `scheduleChanged` out.
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
            : open
              ? no("open_appeal", "A proposed substitute is open. It is settled or withdrawn before the decision is contested.")
              : scheduleChanged
                ? no("open_appeal", "A substitute has come into force since this decision, so it was about a different schedule. Ask for a cure round instead.")
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
                : nowMs <= workEndsMs(m, terms.deadline)
                  ? "A decision that fell short can still be put right."
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
