/**
 * The per-item agent loop (README §6). SERVER-ONLY.
 *
 * For one feedback item the agent:
 *   1. analyzes it, and DECIDES whether to call lookup_known_issues;
 *   2. (if it calls the tool) reads the result and folds it into its judgment;
 *   3. emits a classification + a calibrated confidence;
 *   4. is then flagged for human review if confidence is low or the item is a
 *      novel critical / ambiguous case.
 * Every step is recorded in a trace so the UI can show the reasoning.
 */
import "server-only";
import type OpenAI from "openai";
import { openaiClient, MODELS } from "../openai";
import { knownIssues } from "../data";
import { CLASSIFY_SYSTEM_AGENT, classifyUser } from "./prompts";
import { LOOKUP_TOOL, runLookup } from "./tools";
import {
  CONFIDENCE_THRESHOLD,
  type Classification,
  type FeedbackItem,
  type KnownIssueRef,
  type Sentiment,
  type Severity,
  type TraceStep,
} from "../types";

const SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative", "mixed"];
const MAX_TURNS = 4;

export interface ItemAnalysis {
  classification: Classification;
  confidence: number;
  known_issue: KnownIssueRef | null;
  reasoning: string;
  flagged: boolean;
  flag_reason: string | null;
  trace: TraceStep[];
}

function tryParse(content: string | null): Record<string, unknown> | null {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/** Decide whether a human should review this item — explicit, documented rules. */
function decideFlag(
  confidence: number,
  severity: Severity,
  sentiment: Sentiment,
  knownIssue: KnownIssueRef | null,
): { flagged: boolean; reason: string | null } {
  if (confidence < CONFIDENCE_THRESHOLD) {
    return {
      flagged: true,
      reason: `Low confidence (${confidence} < ${CONFIDENCE_THRESHOLD}).`,
    };
  }
  // Bias toward recall on critical signal (README §9): a novel critical issue
  // the team isn't already tracking deserves human eyes.
  if (severity === 4 && !knownIssue) {
    return {
      flagged: true,
      reason: "Critical and not a known issue — escalating for human review.",
    };
  }
  if (sentiment === "mixed") {
    return { flagged: true, reason: "Mixed sentiment — ambiguous, worth a human glance." };
  }
  return { flagged: false, reason: null };
}

export async function analyzeItemWithAgent(item: FeedbackItem): Promise<ItemAnalysis> {
  const trace: TraceStep[] = [];
  let step = 0;
  let usedTool = false;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: CLASSIFY_SYSTEM_AGENT },
    { role: "user", content: classifyUser(item) },
  ];

  let final: Record<string, unknown> | null = null;

  for (let turn = 0; turn < MAX_TURNS && !final; turn++) {
    const res = await openaiClient().chat.completions.create({
      model: MODELS.cheap,
      temperature: 0.2,
      tools: [LOOKUP_TOOL],
      messages,
    });
    const msg = res.choices[0].message;

    const assistant: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
      role: "assistant",
      content: msg.content,
    };
    if (msg.tool_calls) assistant.tool_calls = msg.tool_calls;
    messages.push(assistant);

    if (msg.tool_calls?.length) {
      usedTool = true;
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        const args = tryParse(tc.function.arguments) ?? {};
        const query = String(args.query ?? "");
        trace.push({
          step: ++step,
          type: "tool_call",
          summary: `lookup_known_issues("${query}")`,
        });
        const results = runLookup(query);
        trace.push({
          step: ++step,
          type: "tool_result",
          summary: results.length
            ? `${results.length} known-issue match: ${results.map((r) => r.id).join(", ")}`
            : "No known-issue match",
          detail:
            results.map((r) => `${r.id} — ${r.title} (${r.status})`).join("; ") || undefined,
        });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(results),
        });
      }
      continue;
    }

    // No tool call → this should be the final JSON answer.
    const parsed = tryParse(msg.content);
    if (parsed) {
      final = parsed;
    } else {
      messages.push({
        role: "user",
        content: "Return ONLY the JSON object described in the instructions, no prose.",
      });
    }
  }

  if (!final) {
    throw new Error(`Agent did not produce a final classification for ${item.id}.`);
  }

  // ---- Coerce the model output into safe, typed values ----
  const sevNum = Math.round(Number(final.severity));
  const severity = Math.min(4, Math.max(1, isNaN(sevNum) ? 2 : sevNum)) as Severity;
  const sentiment = SENTIMENTS.includes(final.sentiment as Sentiment)
    ? (final.sentiment as Sentiment)
    : "neutral";
  const confidence = Math.min(1, Math.max(0, Number(final.confidence)));
  const safeConfidence = isNaN(confidence) ? 0.5 : Math.round(confidence * 100) / 100;
  const classification: Classification = {
    feature_area: String(final.feature_area || "Uncategorized").trim(),
    sentiment,
    severity,
    core_ask: String(final.core_ask || "").trim(),
  };

  // Resolve a known-issue match only if the model returned a real KI id.
  const matchId = final.known_issue_id ? String(final.known_issue_id) : null;
  const ki = matchId ? knownIssues.find((k) => k.id === matchId) : undefined;
  const known_issue: KnownIssueRef | null = ki
    ? { id: ki.id, title: ki.title, status: ki.status, severity: ki.severity }
    : null;

  const reasoning = String(final.reasoning || "").trim();

  trace.push({
    step: ++step,
    type: "model",
    summary: usedTool
      ? `Classified using known-issues context: ${classification.feature_area}, severity ${severity}, confidence ${safeConfidence}`
      : `Classified directly (no lookup needed): ${classification.feature_area}, severity ${severity}, confidence ${safeConfidence}`,
    detail: reasoning || undefined,
  });

  const { flagged, reason } = decideFlag(safeConfidence, severity, sentiment, known_issue);
  trace.push({
    step: ++step,
    type: "decision",
    summary: flagged ? `Flagged for human review` : "Auto-accepted",
    detail: flagged ? reason ?? undefined : `Confidence ${safeConfidence} ≥ ${CONFIDENCE_THRESHOLD}.`,
  });

  return {
    classification,
    confidence: safeConfidence,
    known_issue,
    reasoning,
    flagged,
    flag_reason: reason,
    trace,
  };
}
