/**
 * The shapes the contract's views return. Every one of these was read off the
 * deployment of record rather than inferred from the Python, so a field that
 * is optional here is optional because the chain returned it that way.
 *
 * A note on naming that matters for the whole app: a schedule LINE is a piece
 * of equipment the contract says must be installed, and its STATUS is what a
 * panel found when it looked for it. A CRITERION is a sentence about the
 * installation as a whole. A DECISION is derived in the contract from those
 * two, never asked of a model.
 */

export type LineStatus =
  | "INSTALLED"
  | "UNIDENTIFIED"
  | "NOT_SHOWN"
  | "ABSENT"
  | "CONTRADICTED";

export type CriterionStatus = "MET" | "NOT_MET" | "UNCLEAR";

export type Decision = "ACCEPTED" | "REJECTED" | "UNDETERMINED";

export type MilestoneState =
  | "AWAITING_TERMS"
  | "AWAITING_EVIDENCE"
  | "ACCEPTED"
  | "REJECTED"
  | "UNDETERMINED"
  | "APPEALED"
  | "FINALIZED"
  | "CLOSED";

export type ProjectState = "PROPOSED" | "ACTIVE" | "CANCELLED";

export type Quality = "SUFFICIENT" | "INSUFFICIENT" | "CONFLICTING";

export type Role = "OWNER" | "INSTALLER" | "INSPECTOR";

/** What a filed item is. A declaration is recorded but never put to a panel. */
export type ItemKind = "IMAGE" | "DOCUMENT" | "DECLARATION";

/** What an evidence requirement may ask for. A requirement never asks for a declaration. */
export type RequirementKind = "IMAGE" | "DOCUMENT";

export type RoundKind = "ASSESSMENT" | "APPEAL";

/** A piece of equipment the contract requires, as written in the terms. */
export interface EquipmentLine {
  id: string;
  role: string;
  manufacturer: string;
  model: string;
  rating: string;
  quantity: number;
  /** True when the line demands the nameplate be legible in a photograph. */
  identify: boolean;
}

export interface Criterion {
  id: string;
  text: string;
}

export interface EvidenceRequirement {
  id: string;
  kind: RequirementKind;
  from_role: string;
  min_count: number;
  text: string;
}

/** One version of a milestone's terms. Terms change only by agreement. */
export interface TermsVersion {
  version: number;
  title: string;
  milestone_type: string;
  description: string;
  specification: string;
  requirements: string;
  payment_wei: string;
  deadline: string;
  equipment: EquipmentLine[];
  criteria: Criterion[];
  evidence_requirements: EvidenceRequirement[];
}

/** The decision that currently stands on a milestone, and whether it can be contested. */
export interface Standing {
  round: number;
  decision: Decision;
  at: string;
  kind: string;
  appealable: boolean;
  appealed: boolean;
  window_ends: string | null;
  item_mark: number;
}

export interface AppealState {
  reviewed_round: number;
  reason: string;
  opened_at: string;
  evidence_ends: string;
  by: string;
}

/** A filed item: a photograph held on chain, or a document's text. */
export interface EvidenceItem {
  item_id: string;
  milestone_id: string;
  project_id: string;
  kind: ItemKind;
  role: Role;
  filed_by: string;
  filed_at: string;
  version: number;
  sha256: string;
  bytes: number;
  caption: string;
  origin: string;
  equipment_id: string;
  requirement_id: string;
  claimed_capture: string;
  claimed_location: string;
}

export interface MilestoneSummary {
  milestone_id: string;
  index: number;
  title: string;
  milestone_type: string;
  state: MilestoneState;
  deadline: string;
  payment_wei: string;
  current_version: number;
  latest_version: number;
  pending_version: number | null;
  rounds_count: number;
  schedule_lines: number;
  standing: Standing | null;
  appeal: AppealState | null;
}

export interface Project {
  project_id: string;
  title: string;
  description: string;
  site: string;
  system_type: string;
  capacity_kw: string;
  state: ProjectState;
  owner: string;
  installer: string;
  inspector: string;
  installer_accepted_at: string | null;
  inspector_accepted_at: string | null;
  appeal_window_seconds: number;
  created_at: string;
  escrow_wei: string;
  funded_wei: string;
  reserved_wei: string;
  unreserved_wei: string;
  paid_wei: string;
  returned_wei: string;
  milestones: string[];
  milestone_summaries: MilestoneSummary[];
  events_count: number;
  /** The chain's own clock at the moment of the read, never the browser's. */
  now: string;
}

export interface Milestone {
  milestone_id: string;
  project_id: string;
  index: number;
  state: MilestoneState;
  current_version: number;
  pending_version: number | null;
  versions: TermsVersion[];
  /** Filed items keyed by the terms version they were filed against. */
  evidence: Record<string, EvidenceItem[]>;
  rounds_count: number;
  version_assessments: number;
  standing: Standing | null;
  appeal: AppealState | null;
  reserved_wei: string;
  created_at: string;
  closed_at: string | null;
  close_reason: string | null;
  now: string;
}

/** What one node read off one image, kept so a reader can see the basis. */
export interface ImageReading {
  item_id: string;
  role: string;
  origin: string;
  claimed_line: string;
  caption: string;
  readable: boolean;
  shows: string;
  labels: string[];
  concerns: string[];
}

export interface RoundNotes {
  reasoning: string;
  images: ImageReading[];
  line_notes: Record<string, string>;
  lines_raw: Record<string, string>;
  criteria_raw: Record<string, string>;
  basis: Record<string, string[]>;
  criteria_basis: Record<string, string[]>;
  conflict_note: string;
}

/** The items the panel was shown, as recorded with the round. */
export interface RoundEvidence {
  item_id: string;
  kind: ItemKind;
  role: Role;
  sha256: string;
  equipment_id: string;
  new: boolean;
}

export interface Round {
  milestone_id: string;
  project_id: string;
  round: number;
  version: number;
  kind: RoundKind;
  decision: Decision;
  quality: Quality;
  lines: Record<string, LineStatus>;
  criteria: Record<string, CriterionStatus>;
  conflicts_detected: boolean;
  /** The lines and criteria that actually drove the decision. */
  decisive: { lines: string[]; criteria: string[] };
  notes: RoundNotes;
  evidence: RoundEvidence[];
  new_item_ids: string[];
  reviewed_round: number | null;
  appeal_reason: string;
  requested_by: string;
  at: string;
}

export interface ProjectEvent {
  n: number;
  kind: string;
  milestone_id: string;
  by: string;
  detail: string;
  at: string;
}

export interface EventsPage {
  total: number;
  events: ProjectEvent[];
}

export interface Stats {
  projects: number;
  milestones: number;
  rounds: number;
  finalized: number;
  evidence_items: number;
  paid_wei: string;
}

export interface Balance {
  claimable: string;
  claimed: string;
}

export interface Config {
  ruleset: string;
  line_statuses: string[];
  equipment_roles: string[];
  system_types: string[];
  milestone_types: string[];
  images_per_prompt: number;
  max_image_bytes: number;
  max_text_chars: number;
  max_schedule_lines: number;
  max_criteria: number;
  max_evidence_requirements: number;
  max_milestones_per_project: number;
  max_versions_per_milestone: number;
  max_assessments_per_version: number;
  max_projects_per_page: number;
  max_deadline_days_ahead: number;
  min_appeal_window_seconds: number;
  max_appeal_window_seconds: number;
  appeal_lapse_seconds: number;
  min_payment_wei: string;
  quotas: Record<string, Record<string, number>>;
  max_named: Record<string, number>;
  appeal_additions: Record<string, number>;
}

export interface ProjectList {
  total: number;
  project_ids: string[];
}
