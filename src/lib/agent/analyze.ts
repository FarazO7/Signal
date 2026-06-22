/**
 * The Phase 1 analysis pipeline (server-only):
 *   classify each item (1 cheap call/item) → synthesize themes (1 smart call)
 *   → score & rank deterministically.
 *
 * "Agentic" decisions (tool calls, confidence, human-in-the-loop) arrive in
 * Phase 2; this is the simplest honest end-to-end path.
 */
import { chatJSON, MODELS, mapWithConcurrency } from "../openai";
import {
  CLASSIFY_SYSTEM,
  classifyUser,
  SYNTHESIZE_SYSTEM,
  synthesizeUser,
} from "./prompts";
import type {
  AnalyzedItem,
  Brief,
  Classification,
  FeedbackItem,
  Severity,
  Sentiment,
  Theme,
} from "../types";

const SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative", "mixed"];

/** Coerce a raw model object into a safe Classification (clamp + defaults). */
function coerceClassification(raw: unknown): Classification {
  const o = (raw ?? {}) as Record<string, unknown>;
  const sevNum = Math.round(Number(o.severity));
  const severity = (Math.min(4, Math.max(1, isNaN(sevNum) ? 2 : sevNum)) as Severity);
  const sentiment = SENTIMENTS.includes(o.sentiment as Sentiment)
    ? (o.sentiment as Sentiment)
    : "neutral";
  return {
    feature_area: String(o.feature_area || "Uncategorized").trim(),
    sentiment,
    severity,
    core_ask: String(o.core_ask || "").trim(),
  };
}

/** Classify one feedback item with the cheap model. */
async function classifyOne(item: FeedbackItem): Promise<AnalyzedItem> {
  const raw = await chatJSON<unknown>({
    model: MODELS.cheap,
    system: CLASSIFY_SYSTEM,
    user: classifyUser(item),
  });
  return { ...item, classification: coerceClassification(raw) };
}

interface RawTheme {
  label?: string;
  feature_area?: string;
  suggested_action?: string;
  member_ids?: unknown;
}

/**
 * Build the final themes: keep only real member ids, compute frequency +
 * severity + score from the data (not the model), and sort by score.
 */
function assembleThemes(
  analyzed: AnalyzedItem[],
  rawThemes: RawTheme[],
): Theme[] {
  const byId = new Map(analyzed.map((a) => [a.id, a]));
  const used = new Set<string>();
  const themes: Theme[] = [];

  for (const rt of rawThemes) {
    const ids = Array.isArray(rt.member_ids) ? rt.member_ids.map(String) : [];
    // Grounding-lite: drop ids that don't exist and any already used.
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
    themes.push(
      buildTheme(`${area} — other reports`, area, "Review these individually.", ids, byId),
    );
  }

  return themes.sort((a, b) => b.score - a.score);
}

function buildTheme(
  label: string | undefined,
  area: string | undefined,
  action: string | undefined,
  memberIds: string[],
  byId: Map<string, AnalyzedItem>,
): Theme {
  const sevs = memberIds.map((id) => byId.get(id)!.classification.severity);
  const count = memberIds.length;
  const max_severity = Math.max(...sevs) as Severity;
  const avg_severity = sevs.reduce((s, v) => s + v, 0) / count;
  return {
    label: (label || "Untitled theme").trim(),
    feature_area: (area || byId.get(memberIds[0])!.classification.feature_area).trim(),
    suggested_action: (action || "").trim(),
    member_ids: memberIds,
    count,
    max_severity,
    avg_severity: Math.round(avg_severity * 100) / 100,
    // Explainable priority (README Decision 6): frequency × average severity.
    score: Math.round(count * avg_severity * 100) / 100,
  };
}

/** Run the full pipeline over a batch of feedback. */
export async function analyzeFeedback(items: FeedbackItem[]): Promise<Brief> {
  // 1. Classify every item (bounded concurrency).
  const analyzed = await mapWithConcurrency(items, 5, classifyOne);

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
    items: analyzed,
    themes,
  };
}
