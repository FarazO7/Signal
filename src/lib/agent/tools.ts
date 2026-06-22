/**
 * The lookup_known_issues context tool (README §6, step 3).
 *
 * The agent DECIDES when to call this during per-item analysis — it isn't
 * called on a fixed schedule. The executor is deterministic: a keyword search
 * over data/known_issues.json. SERVER-ONLY (reads the known-issues store).
 */
import "server-only";
import type OpenAI from "openai";
import { knownIssues } from "../data";

/** The function-tool definition handed to the model. */
export const LOOKUP_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "lookup_known_issues",
    description:
      "Search the team's known-issues store to check whether this feedback is already a tracked bug or a duplicate. Call this when the feedback sounds like a concrete problem that might already be known (e.g. a checkout failure, a charge problem, a broken feature). Skip it for clearly novel asks, praise, or vague comments.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "A few keywords capturing the core problem, e.g. 'saved card checkout fails' or 'charged twice'.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export interface LookupResult {
  id: string;
  title: string;
  status: string;
  severity: number;
  summary: string;
}

/** Deterministic keyword match: score by how many query words hit a record. */
export function runLookup(query: string): LookupResult[] {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return [];

  const scored = knownIssues.map((ki) => {
    const haystack = [ki.title, ki.summary, ki.area, ...ki.keywords]
      .join(" ")
      .toLowerCase();
    const hits = words.filter((w) => haystack.includes(w)).length;
    return { ki, hits };
  });

  return scored
    .filter((s) => s.hits >= 2) // need a couple of word hits to count as a match
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map(({ ki }) => ({
      id: ki.id,
      title: ki.title,
      status: ki.status,
      severity: ki.severity,
      summary: ki.summary,
    }));
}
