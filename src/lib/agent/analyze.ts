/**
 * The analysis pipeline (server-only):
 *   per-item AGENT loop (tool use + confidence + flag) → synthesize themes →
 *   score & rank deterministically.
 */
import { chatJSON, MODELS, mapWithConcurrency } from "../openai";
import { analyzeItemWithAgent } from "./loop";
import { SYNTHESIZE_SYSTEM, synthesizeUser } from "./prompts";
import { aggregateSeverities } from "../scoring";
import {
  CONFIDENCE_THRESHOLD,
  type AnalyzedItem,
  type Brief,
  type FeedbackItem,
  type Theme,
} from "../types";

interface RawTheme {
  label?: string;
  feature_area?: string;
  suggested_action?: string;
  member_ids?: unknown;
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

/**
 * Build final themes: keep only real, not-yet-used member ids, compute
 * frequency + severity + score from the data, and sort by score.
 */
function assembleThemes(analyzed: AnalyzedItem[], rawThemes: RawTheme[]): Theme[] {
  const byId = new Map(analyzed.map((a) => [a.id, a]));
  const used = new Set<string>();
  const themes: Theme[] = [];

  for (const rt of rawThemes) {
    const ids = Array.isArray(rt.member_ids) ? rt.member_ids.map(String) : [];
    const members = ids.filter((id) => byId.has(id) && !used.has(id));
    if (members.length === 0) continue;
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

  return themes.sort((a, b) => b.score - a.score);
}

/** Run the full pipeline over a batch of feedback. */
export async function analyzeFeedback(items: FeedbackItem[]): Promise<Brief> {
  // 1. Per-item agent loop (tool use + confidence + flagging). Bounded
  //    concurrency — each item may make multiple model calls.
  const analyses = await mapWithConcurrency(items, 4, (it) => analyzeItemWithAgent(it));
  const analyzed: AnalyzedItem[] = items.map((it, i) => ({ ...it, ...analyses[i] }));

  // 2. Synthesize themes from the compact classified rows.
  const { themes: rawThemes } = await chatJSON<{ themes: RawTheme[] }>({
    model: MODELS.smart,
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

  // 3. Assemble + rank deterministically.
  const themes = assembleThemes(analyzed, Array.isArray(rawThemes) ? rawThemes : []);

  return {
    generated_at: new Date().toISOString(),
    item_count: analyzed.length,
    flagged_count: analyzed.filter((a) => a.flagged).length,
    confidence_threshold: CONFIDENCE_THRESHOLD,
    items: analyzed,
    themes,
  };
}
