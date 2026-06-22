/**
 * The analysis pipeline (server-only):
 *   per-item AGENT loop (tool use + confidence + schema-validated) →
 *   synthesize themes (schema-validated) → GROUND (cite-or-drop) → rank.
 *
 * Guardrails (README §9): every model response is validated against a schema
 * with a re-request on violation, and every theme must cite ≥1 real source item
 * or it is dropped.
 */
import { chatValidated, MODELS, mapWithConcurrency } from "../openai";
import { analyzeItemWithAgent } from "./loop";
import { SYNTHESIZE_SYSTEM, synthesizeUser } from "./prompts";
import { SynthesisSchema } from "./schema";
import { aggregateSeverities } from "../scoring";
import {
  CONFIDENCE_THRESHOLD,
  type AnalyzedItem,
  type Brief,
  type FeedbackItem,
  type Theme,
} from "../types";

interface RawTheme {
  label: string;
  feature_area: string;
  suggested_action: string;
  member_ids: string[];
}

function buildTheme(
  label: string | undefined,
  area: string | undefined,
  action: string | undefined,
  memberIds: string[],
  byId: Map<string, AnalyzedItem>,
): Theme {
  const sevs = memberIds.map((id) => byId.get(id)!.classification.severity);
  const agg = aggregateSeverities(sevs); // count, max_severity, avg_severity, score
  return {
    label: (label || "Untitled theme").trim(),
    feature_area: (area || byId.get(memberIds[0])!.classification.feature_area).trim(),
    suggested_action: (action || "").trim(),
    member_ids: memberIds,
    ...agg,
  };
}

interface AssembleResult {
  themes: Theme[];
  themesDropped: number;
  hallucinatedRefs: number;
}

/**
 * GROUNDING (cite-or-drop): keep only real, not-yet-used member ids; compute
 * frequency/severity/score from the data; sort by score. Any theme left with no
 * real citation is dropped, and citations to non-existent items are counted.
 */
function assembleThemes(analyzed: AnalyzedItem[], rawThemes: RawTheme[]): AssembleResult {
  const byId = new Map(analyzed.map((a) => [a.id, a]));
  const used = new Set<string>();
  const themes: Theme[] = [];
  let themesDropped = 0;
  let hallucinatedRefs = 0;

  for (const rt of rawThemes) {
    const ids = Array.isArray(rt.member_ids) ? rt.member_ids.map(String) : [];
    hallucinatedRefs += ids.filter((id) => !byId.has(id)).length;
    const members = ids.filter((id) => byId.has(id) && !used.has(id));
    if (members.length === 0) {
      themesDropped++; // ungrounded — cite-or-drop
      continue;
    }
    members.forEach((id) => used.add(id));
    themes.push(buildTheme(rt.label, rt.feature_area, rt.suggested_action, members, byId));
  }

  // Don't silently drop items the model left out — bucket leftovers by area.
  const leftovers = analyzed.filter((a) => !used.has(a.id));
  const byArea = new Map<string, string[]>();
  for (const a of leftovers) {
    const area = a.classification.feature_area;
    const bucket = byArea.get(area) ?? [];
    bucket.push(a.id);
    byArea.set(area, bucket);
  }
  for (const [area, ids] of byArea) {
    themes.push(buildTheme(`${area} — other reports`, area, "Review these individually.", ids, byId));
  }

  return { themes: themes.sort((a, b) => b.score - a.score), themesDropped, hallucinatedRefs };
}

/** Run the full pipeline over a batch of feedback. */
export async function analyzeFeedback(items: FeedbackItem[]): Promise<Brief> {
  // 1. Per-item agent loop (tool use + confidence + schema validation).
  const analyses = await mapWithConcurrency(items, 4, (it) => analyzeItemWithAgent(it));
  const analyzed: AnalyzedItem[] = items.map((it, i) => ({ ...it, ...analyses[i] }));
  const itemRerequests = analyses.reduce((sum, a) => sum + a.rerequests, 0);

  // 2. Synthesize themes — validated against the schema, with re-request.
  const { data: synthesis, rerequests: synRerequests } = await chatValidated({
    model: MODELS.smart,
    schema: SynthesisSchema,
    system: SYNTHESIZE_SYSTEM,
    user: synthesizeUser(
      analyzed.map((a) => ({
        id: a.id,
        feature_area: a.classification.feature_area,
        severity: a.classification.severity,
        core_ask: a.classification.core_ask,
      })),
    ),
  });

  // 3. Ground + rank. If synthesis never validated, themes is empty and every
  //    item falls through to the grounded leftover buckets — still a valid brief.
  const { themes, themesDropped, hallucinatedRefs } = assembleThemes(
    analyzed,
    synthesis?.themes ?? [],
  );

  return {
    generated_at: new Date().toISOString(),
    item_count: analyzed.length,
    flagged_count: analyzed.filter((a) => a.flagged).length,
    confidence_threshold: CONFIDENCE_THRESHOLD,
    guardrails: {
      themes_dropped: themesDropped,
      hallucinated_refs_dropped: hallucinatedRefs,
      schema_rerequests: itemRerequests + synRerequests,
    },
    items: analyzed,
    themes,
  };
}
