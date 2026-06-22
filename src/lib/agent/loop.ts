/**
 * The per-item agent loop (README §6). SERVER-ONLY.
 *
 * For one feedback item the agent:
 *   1. analyzes it, and DECIDES whether to call lookup_known_issues;
 *   2. (if it calls the tool) reads the result and folds it into its judgment;
 *   3. emits a classification + confidence, VALIDATED against a schema — a
 *      violation triggers a corrective re-request (README §9, Decision 4);
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
import { ClassificationSchema, formatZodError, type ClassificationOut } from "./schema";
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
const MAX_TURNS = 5; // room for a tool call + a couple of schema re-requests

export interface ItemAnalysis {
  classification: Classification;
  confidence: number;
  known_issue: KnownIssueRef | null;
  reasoning: string;
  flagged: boolean;
  flag_reason: string | null;
  trace: TraceStep[];
  /** How many times the model had to be asked again for schema-valid output. */
  rerequests: number;
}

function tryParse(content: string | null): unknown {
  if (!content) return undefined;
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
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
    return { flagged: true, reason: `Low confidence (${confidence} < ${CONFIDENCE_THRESHOLD}).` };
  }
  // Bias toward recall on critical signal (README §9): a novel critical issue
  // the team isn't already tracking deserves human eyes.
  if (severity === 4 && !knownIssue) {
    return { flagged: true, reason: "Critical and not a known issue — escalating for human review." };
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
  let rerequests = 0;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: CLASSIFY_SYSTEM_AGENT },
    { role: "user", content: classifyUser(item) },
  ];

  let valid: ClassificationOut | null = null;
  let lastParsed: unknown;

  for (let turn = 0; turn < MAX_TURNS && !valid; turn++) {
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

    // --- Tool turn ---
    if (msg.tool_calls?.length) {
      usedTool = true;
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        const args = tryParse(tc.function.arguments) as { query?: string } | undefined;
        const query = String(args?.query ?? "");
        trace.push({ step: ++step, type: "tool_call", summary: `lookup_known_issues("${query}")` });
        const results = runLookup(query);
        trace.push({
          step: ++step,
          type: "tool_result",
          summary: results.length
            ? `${results.length} known-issue match: ${results.map((r) => r.id).join(", ")}`
            : "No known-issue match",
          detail: results.map((r) => `${r.id} — ${r.title} (${r.status})`).join("; ") || undefined,
        });
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(results) });
      }
      continue;
    }

    // --- Final-answer turn: validate against the schema ---
    const parsed = tryParse(msg.content);
    lastParsed = parsed;
    const result = parsed !== undefined ? ClassificationSchema.safeParse(parsed) : null;
    if (result?.success) {
      valid = result.data;
      break;
    }

    // Schema violation → corrective re-request (the guardrail in action).
    rerequests++;
    const reason =
      parsed === undefined ? "Output was not valid JSON." : formatZodError(result!.error);
    trace.push({
      step: ++step,
      type: "decision",
      summary: "Schema violation — re-requesting",
      detail: reason,
    });
    messages.push({
      role: "user",
      content: `Your reply did not match the required schema: ${reason}. Return ONLY a corrected JSON object that matches the schema.`,
    });
  }

  // ---- Build the analysis (validated path, or a best-effort fallback) ----
  let classification: Classification;
  let confidence: number;
  let matchId: string | null;
  let reasoning: string;
  let schemaFailed = false;

  if (valid) {
    classification = {
      feature_area: valid.feature_area.trim(),
      sentiment: valid.sentiment,
      severity: valid.severity as Severity,
      core_ask: valid.core_ask.trim(),
    };
    confidence = Math.round(valid.confidence * 100) / 100;
    matchId = valid.known_issue_id;
    reasoning = valid.reasoning.trim();
  } else {
    // Never got schema-valid output. Use what we can and force a human to look.
    schemaFailed = true;
    const o = (lastParsed ?? {}) as Record<string, unknown>;
    const sev = Math.round(Number(o.severity));
    classification = {
      feature_area: String(o.feature_area || "Uncategorized").trim(),
      sentiment: SENTIMENTS.includes(o.sentiment as Sentiment) ? (o.sentiment as Sentiment) : "neutral",
      severity: (Math.min(4, Math.max(1, isNaN(sev) ? 2 : sev)) as Severity),
      core_ask: String(o.core_ask || item.text.slice(0, 80)).trim(),
    };
    confidence = 0.3; // low on purpose, so decideFlag escalates it
    matchId = o.known_issue_id ? String(o.known_issue_id) : null;
    reasoning = String(o.reasoning || "Schema validation failed; classification is best-effort.").trim();
  }

  const ki = matchId ? knownIssues.find((k) => k.id === matchId) : undefined;
  const known_issue: KnownIssueRef | null = ki
    ? { id: ki.id, title: ki.title, status: ki.status, severity: ki.severity }
    : null;

  trace.push({
    step: ++step,
    type: "model",
    summary: `${schemaFailed ? "Best-effort (schema failed)" : usedTool ? "Classified using known-issues context" : "Classified directly (no lookup needed)"}: ${classification.feature_area}, severity ${classification.severity}, confidence ${confidence}`,
    detail: reasoning || undefined,
  });

  const { flagged, reason } = decideFlag(
    confidence,
    classification.severity,
    classification.sentiment,
    known_issue,
  );
  trace.push({
    step: ++step,
    type: "decision",
    summary: flagged ? "Flagged for human review" : "Auto-accepted",
    detail: flagged ? reason ?? undefined : `Confidence ${confidence} ≥ ${CONFIDENCE_THRESHOLD}.`,
  });

  return { classification, confidence, known_issue, reasoning, flagged, flag_reason: reason, trace, rerequests };
}
