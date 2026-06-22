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

/** A feedback item joined with its classification. */
export interface AnalyzedItem extends FeedbackItem {
  classification: Classification;
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

/** The full output of one analysis run. */
export interface Brief {
  generated_at: string;
  item_count: number;
  /** Every analyzed item, so the UI can show "raw feedback → brief". */
  items: AnalyzedItem[];
  /** Themes, already sorted by score (highest priority first). */
  themes: Theme[];
}
