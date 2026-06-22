/**
 * Shared types for the Signal agent.
 *
 * Phase 1 keeps these intentionally small: just enough to carry a raw feedback
 * item through classification → theme synthesis → a basic prioritized brief.
 * Phase 2+ will extend these (confidence, tool results, agent trace, grounding).
 */

/** A raw feedback item as it arrives in data/sample_feedback.json. */
export interface FeedbackItem {
  id: string;
  channel: string;
  date: string;
  rating: number | null;
  text: string;
}

export type Sentiment = "positive" | "neutral" | "negative" | "mixed";

/** Severity rubric (README §15): 4 critical · 3 high · 2 medium · 1 low. */
export type Severity = 1 | 2 | 3 | 4;

/** The agent's per-item analysis (one LLM call per item in Phase 1). */
export interface Classification {
  feature_area: string;
  sentiment: Sentiment;
  severity: Severity;
  /** The underlying request/problem in plain language. */
  core_ask: string;
}

/** A reference to a matched entry in the known-issues store. */
export interface KnownIssueRef {
  id: string;
  title: string;
  status: string;
  severity: number;
}

/** One step the agent took on an item — what the trace view renders. */
export interface TraceStep {
  step: number;
  type: "model" | "tool_call" | "tool_result" | "decision";
  summary: string;
  detail?: string;
}

/**
 * A feedback item joined with the agent's full analysis: its classification,
 * confidence, any known-issue match, whether it was flagged for human review,
 * and the inspectable trace of steps it took.
 */
export interface AnalyzedItem extends FeedbackItem {
  classification: Classification;
  /** Model-reported confidence, 0–1 (clamped). */
  confidence: number;
  /** Set when the agent's lookup_known_issues call matched a tracked issue. */
  known_issue: KnownIssueRef | null;
  /** The agent's one-line rationale for its classification. */
  reasoning: string;
  /** True when the item needs a human to look before the brief is final. */
  flagged: boolean;
  /** Why it was flagged (or null if auto-accepted). */
  flag_reason: string | null;
  /** The agent's step-by-step trace for this item. */
  trace: TraceStep[];
}

/**
 * A cluster of related items. Counts and severity are computed
 * deterministically from the members (README Decision 6 — explainable ranking),
 * not asked of the model.
 */
export interface Theme {
  label: string;
  feature_area: string;
  suggested_action: string;
  member_ids: string[];
  /** Frequency = number of members. */
  count: number;
  /** Highest severity among members — what the badge shows. */
  max_severity: Severity;
  /** Mean severity among members — used in the score. */
  avg_severity: number;
  /** Explainable priority score = count × avg_severity. */
  score: number;
}

/** What the grounding + schema guardrails caught during a run (README §9). */
export interface BriefGuardrails {
  /** Themes the model proposed that cited no real feedback — dropped. */
  themes_dropped: number;
  /** Member-id citations that pointed at no real item — dropped. */
  hallucinated_refs_dropped: number;
  /** Total schema re-requests across the run (parse/validation violations). */
  schema_rerequests: number;
}

/** The full output of one analysis run. */
export interface Brief {
  generated_at: string;
  item_count: number;
  /** How many items were flagged for human review. */
  flagged_count: number;
  /** The confidence threshold below which items are flagged (for display). */
  confidence_threshold: number;
  /** Grounding + schema guardrail tallies. */
  guardrails: BriefGuardrails;
  /** Every analyzed item, so the UI can show "raw feedback → brief". */
  items: AnalyzedItem[];
  /** Themes, already sorted by score (highest priority first). */
  themes: Theme[];
}

/** Items below this confidence are flagged for human review (README Decision 5). */
export const CONFIDENCE_THRESHOLD = 0.65;
