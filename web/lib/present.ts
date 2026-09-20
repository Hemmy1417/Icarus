/**
 * Every word a person reads passes through here. The contract speaks in
 * SCREAMING_SNAKE because that is what a state machine should look like on
 * chain; a page should not. This module is the one place that turns machine
 * vocabulary into sentences, so a screen cannot go wrong on its own, and so
 * a change of wording is a change to one file.
 *
 * The rule the whole interface is built on: identifiers, addresses, digests
 * and raw enum names never appear in reading flow. They belong in the
 * verification views, where a reader has asked to see exactly what was
 * recorded. Everything else is written out.
 */

/** LOAD_BEARING becomes "Load bearing". A fallback, not a substitute for a map. */
export function humanize(value: string): string {
  const t = String(value ?? "").trim();
  if (!t) return "";
  const spaced = t.replace(/[_-]+/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function label(map: Record<string, string>, key: string | null | undefined): string {
  const k = String(key ?? "").trim();
  if (!k) return "";
  return map[k] ?? humanize(k);
}

const PROJECT_STATE: Record<string, string> = {
  PROPOSED: "Awaiting the installer",
  ACTIVE: "Under way",
  CANCELLED: "Cancelled",
};
export const projectState = (s: string) => label(PROJECT_STATE, s);

const MILESTONE_STATE: Record<string, string> = {
  AWAITING_TERMS: "Awaiting agreement",
  AWAITING_EVIDENCE: "Open for evidence",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  UNDETERMINED: "Undetermined",
  APPEALED: "Under appeal",
  FINALIZED: "Settled",
  CLOSED: "Closed",
};
export const milestoneState = (s: string) => label(MILESTONE_STATE, s);

const DECISION: Record<string, string> = {
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  UNDETERMINED: "Undetermined",
};
export const decision = (s: string) => label(DECISION, s);

/** A decision as a noun, for sentences: "contested the acceptance". */
const DECISION_NOUN: Record<string, string> = {
  ACCEPTED: "Acceptance",
  REJECTED: "Rejection",
  UNDETERMINED: "Undetermined finding",
};
export const decisionNoun = (s: string) => label(DECISION_NOUN, s).toLowerCase();

/**
 * What a panel found when it looked for one line of the equipment schedule.
 * These are the five words the whole product turns on, so each is written as
 * a finding rather than a verdict: the contract decides, the panel reports.
 */
const LINE_STATUS: Record<string, string> = {
  INSTALLED: "Installed",
  UNIDENTIFIED: "Not identified",
  NOT_SHOWN: "Not shown",
  ABSENT: "Not there",
  CONTRADICTED: "Evidence disagrees",
};
export const lineStatus = (s: string) => label(LINE_STATUS, s);

/** The same five findings written out, for a reader who wants the sentence. */
const LINE_STATUS_SAID: Record<string, string> = {
  INSTALLED:
    "A photograph shows this item installed, and where the line asks for it, the nameplate identifies it.",
  UNIDENTIFIED:
    "Something of this kind is shown, but nothing in the evidence identifies it as the item the schedule names.",
  NOT_SHOWN: "Nothing in the evidence establishes this line either way.",
  ABSENT: "The evidence shows that the item the schedule names is not what is installed.",
  CONTRADICTED: "Two pieces of evidence disagree with each other about this line.",
};
export const lineStatusSaid = (s: string) => LINE_STATUS_SAID[String(s ?? "")] ?? "";

const CRITERION_STATUS: Record<string, string> = {
  MET: "Met",
  NOT_MET: "Not met",
  UNCLEAR: "Unclear",
};
export const criterionStatus = (s: string) => label(CRITERION_STATUS, s);

const ROLE: Record<string, string> = {
  OWNER: "Owner",
  INSTALLER: "Installer",
  INSPECTOR: "Inspector",
};
export const role = (s: string) => label(ROLE, s);
export const roleLower = (s: string) => role(s).toLowerCase();

const EQUIPMENT_ROLE: Record<string, string> = {
  MODULE: "Module",
  INVERTER: "Inverter",
  BATTERY: "Battery",
  MOUNTING: "Mounting",
  PROTECTION: "Protection",
  METER: "Meter",
  MONITORING: "Monitoring",
};
export const equipmentRole = (s: string) => label(EQUIPMENT_ROLE, s);

const IMAGE_ORIGIN: Record<string, string> = {
  PHOTO: "Photograph",
  NAMEPLATE: "Nameplate",
  VIDEO_FRAME: "Video frame",
  SCAN: "Scan",
};
export const imageOrigin = (s: string) => label(IMAGE_ORIGIN, s);

/** An item said plainly: "Nameplate", "Document", "Declaration". */
export function itemKind(kind: string, origin?: string | null): string {
  if (kind === "IMAGE") return imageOrigin(origin ?? "PHOTO") || "Photograph";
  if (kind === "DECLARATION") return "Declaration";
  return "Document";
}

const QUALITY: Record<string, string> = {
  SUFFICIENT: "Sufficient",
  INSUFFICIENT: "Insufficient",
  CONFLICTING: "Conflicting",
};
export const quality = (s: string) => label(QUALITY, s);

const ROUND_KIND: Record<string, string> = {
  ASSESSMENT: "Assessment",
  APPEAL: "Appeal",
};
export const roundKind = (s: string) => label(ROUND_KIND, s);

const SYSTEM_TYPE: Record<string, string> = {
  ROOFTOP_SOLAR: "Rooftop solar",
  COMMERCIAL_SOLAR: "Commercial solar",
  UTILITY_SCALE_SOLAR: "Utility scale solar",
  SOLAR_PLUS_STORAGE: "Solar with storage",
  MICROGRID: "Microgrid",
  BATTERY_STORAGE: "Battery storage",
  OFF_GRID_POWER: "Off grid power",
  RENEWABLE_ENERGY_MAINTENANCE: "Renewable energy maintenance",
};
export const systemType = (s: string) => label(SYSTEM_TYPE, s);

const MILESTONE_TYPE: Record<string, string> = {
  EQUIPMENT_DELIVERY: "Equipment delivery",
  PV_MOUNTING_COMPLETE: "Mounting complete",
  PV_MODULE_INSTALLATION: "Module installation",
  INVERTER_INSTALLATION: "Inverter installation",
  BATTERY_INSTALLATION: "Battery installation",
  ELECTRICAL_INTEGRATION: "Electrical integration",
  PROTECTION_SYSTEM_INSTALLATION: "Protection system installation",
  MONITORING_SYSTEM_INSTALLATION: "Monitoring system installation",
  COMMISSIONING: "Commissioning",
  PERFORMANCE_TEST: "Performance test",
  FINAL_HANDOVER: "Final handover",
  MAINTENANCE_COMPLETION: "Maintenance completion",
};
export const milestoneType = (s: string) => label(MILESTONE_TYPE, s);

const EVENT: Record<string, string> = {
  PROJECT_CREATED: "Project opened",
  PROJECT_ACCEPTED: "Installer accepted the project",
  INSPECTOR_ACCEPTED: "Inspector accepted the appointment",
  PROJECT_CANCELLED: "Project cancelled",
  ESCROW_FUNDED: "Escrow funded",
  ESCROW_WITHDRAWN: "Escrow withdrawn",
  MILESTONE_PROPOSED: "Milestone proposed",
  VERSION_PROPOSED: "Terms proposed",
  VERSION_ACCEPTED: "Terms agreed",
  EVIDENCE_FILED: "Evidence filed",
  DECISION: "Panel reported",
  APPEAL_OPENED: "Decision contested",
  APPEAL_LAPSED: "Appeal lapsed undecided",
  MILESTONE_PAID: "Milestone settled",
  MILESTONE_CLOSED: "Milestone closed",
};
export const eventKind = (s: string) => label(EVENT, s);

const tail = (id: string) => String(id ?? "").split("-").pop()?.replace(/^0+/, "") || "";

/** ev-000013 reads "Item 13": a person's handle on it, not the identifier. */
export const itemName = (eid: string) => `Item ${tail(eid)}`;
export const itemNumber = (eid: string) => tail(eid);
export const milestoneNumber = (mid: string) => tail(mid);
export const projectNumber = (pid: string) => tail(pid);

/** A round by kind and number: "Assessment 1", "Appeal 2". */
export const roundName = (kind: string, n: number) => `${roundKind(kind) || "Round"} ${n}`;

/** A schedule line as a person would say it: "Inverter, Growatt MOD 4000TL3-X". */
export function lineName(line: {
  role?: string;
  manufacturer?: string;
  model?: string;
}): string {
  const made = [line.manufacturer, line.model].filter(Boolean).join(" ").trim();
  const kind = equipmentRole(line.role ?? "");
  return made ? `${kind}, ${made}` : kind;
}

/**
 * Text a party wrote, shown as a quotation. It is trimmed and its control
 * characters are dropped, and nothing else: a caption is the filer's words,
 * and rewriting them would be editing the record.
 */
export function prose(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * The contract caps a per-line note at 200 characters, so a panel's sentence
 * can arrive cut off mid-word. A page that printed the fragment as though it
 * were the whole note would be misreporting the record, so a note at the cap
 * is marked as cut rather than tidied up or silently completed.
 */
export const LINE_NOTE_MAX = 200;

export function wasCut(text: string | null | undefined): boolean {
  return String(text ?? "").length >= LINE_NOTE_MAX;
}

/**
 * The contract's own sentence from a refused write, tidied into one. The
 * wording is the contract's and is never replaced: a refusal a person reads
 * should be the reason the chain gave, not this app's paraphrase of it.
 */
export function refusal(text: string): string {
  const body = String(text ?? "")
    .replace(/\[EXPECTED\]|\[LLM_ERROR\]/g, "")
    .replace(/^[\s:]+/, "")
    .trim();
  if (!body) return "The contract refused this action.";
  const sentence = body[0]!.toUpperCase() + body.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/**
 * A panel writes in the record's own vocabulary: it cites items as ev-000001
 * and schedule lines as E1, because that is what it was shown. A page must
 * not. This writes those references out into the words a reader already has
 * in front of them, so the panel's sentence survives intact while no machine
 * identifier reaches the page.
 *
 * Only references are touched. The panel's wording, its findings and its
 * reasoning are never altered, because rewriting those would be editing the
 * record rather than presenting it. A replacement that lands at the start of
 * a sentence is capitalised, so substituting for an identifier does not
 * leave the prose ungrammatical.
 */
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];

/**
 * The words to write a panel's references out into. A schedule line is named
 * by its role, and only disambiguated by model when two lines share one: a
 * model number is a product identifier and lowercasing it to fit a sentence
 * would mangle the very thing the schedule is about.
 */
export function referenceNames(
  lines: Array<{ id: string; role: string; model?: string }>,
  criteria: Array<{ id: string }> = [],
): Record<string, string> {
  const out: Record<string, string> = {};
  const roles = lines.map((l) => l.role);
  for (const l of lines) {
    const alone = roles.filter((r) => r === l.role).length === 1;
    const role = equipmentRole(l.role).toLowerCase();
    out[l.id] = alone || !l.model ? `the ${role}` : `the ${role} (${l.model})`;
  }
  criteria.forEach((c, i) => {
    out[c.id] = `the ${ORDINALS[i] ?? "next"} condition`;
  });
  return out;
}

export function writeOut(
  text: string | null | undefined,
  names: Record<string, string> = {},
): string {
  const written = prose(text)
    .replace(/ev-0*(\d+)/gi, (_m, digits: string) => {
      const word = ORDINALS[parseInt(digits, 10) - 1];
      return word ? `the ${word} item` : "an item";
    })
    .replace(/\b([EC]\d{1,2})\b/g, (m: string, id: string) => names[id.toUpperCase()] ?? m);

  // A sentence that now opens with a substituted word still opens a sentence.
  return written.replace(/(^|[.!?]\s+)([a-z])/g, (_m, lead: string, ch: string) =>
    lead + ch.toUpperCase());
}

const GEN_WEI = 10n ** 18n;

/** GEN with up to four decimals, trailing zeros trimmed: "2 GEN", "0.05 GEN". */
export function gen(wei: string | bigint | number | null | undefined, unit = true): string {
  let v: bigint;
  try {
    v = BigInt(typeof wei === "number" ? Math.trunc(wei) : (wei ?? 0));
  } catch {
    return unit ? "0 GEN" : "0";
  }
  const neg = v < 0n;
  if (neg) v = -v;
  const whole = v / GEN_WEI;
  const frac = ((v % GEN_WEI) * 10_000n) / GEN_WEI;
  let text = whole.toLocaleString("en-GB");
  if (frac > 0n) text += `.${frac.toString().padStart(4, "0").replace(/0+$/, "")}`;
  return `${neg ? "-" : ""}${text}${unit ? " GEN" : ""}`;
}

/** Parse a GEN amount a person typed ("2", "0.05") into wei; null if unreadable. */
export function parseGen(text: string): bigint | null {
  const t = String(text ?? "").trim().replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".") return null;
  const [whole = "0", frac = ""] = t.split(".");
  if (frac.length > 18) return null;
  try {
    return BigInt(whole) * GEN_WEI + BigInt((frac + "0".repeat(18)).slice(0, 18));
  } catch {
    return null;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "19 Sep 2026", in UTC like every time the contract records. */
export function day(iso: string | null | undefined): string {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "19 Sep 2026, 15:24 UTC". */
export function moment(iso: string | null | undefined): string {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day(iso)}, ${hh}:${mm} UTC`;
}

/** "10 minutes", "1 hour", "7 days". */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return plural(s, "second");
  if (s < 3600) return plural(Math.round(s / 60), "minute");
  if (s < 86400) return plural(Math.round(s / 3600), "hour");
  return plural(Math.round(s / 86400), "day");
}

/** "in 42 minutes" or "3 hours ago", relative to a clock the caller supplies. */
export function relative(iso: string | null | undefined, nowMs: number): string {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.round((d.getTime() - nowMs) / 1000);
  if (Math.abs(diff) < 45) return diff >= 0 ? "in a moment" : "just now";
  return diff > 0 ? `in ${duration(diff)}` : `${duration(-diff)} ago`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
}

/** A count of bytes: "384 kB". Used only where the size of a file is the point. */
export function bytes(n: number): string {
  const v = Number(n) || 0;
  if (v < 1000) return `${v} bytes`;
  return `${Math.round(v / 100) / 10} kB`;
}

/** 0xAbCd…1234, for verification sections only, never in reading flow. */
export function shortAddress(addr: string): string {
  const a = String(addr ?? "");
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/** A digest, shortened the same way and for the same places. */
export function shortDigest(hex: string): string {
  const h = String(hex ?? "");
  return h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-8)}` : h;
}
