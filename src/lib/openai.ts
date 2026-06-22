/**
 * OpenAI client + small helpers. SERVER-ONLY.
 *
 * The API key is read from process.env (server-side). This module must never be
 * imported by a client component — that would ship the key to the browser.
 *
 * Model routing (README Decision 3): a cheap model for simple per-item
 * classification, a capable model for synthesis. Both are configurable via env
 * so they're easy to swap.
 */
import "server-only";
import OpenAI from "openai";

/** Thrown when the key is missing, so the API route can return a clear 400. */
export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "OPENAI_API_KEY is not set. Copy .env.example to .env and add your key, then restart the dev server.",
    );
    this.name = "MissingApiKeyError";
  }
}

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new MissingApiKeyError();
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export const MODELS = {
  cheap: process.env.SIGNAL_MODEL_CHEAP || "gpt-4o-mini",
  smart: process.env.SIGNAL_MODEL_SMART || "gpt-4o",
};

/**
 * Call a model and parse a JSON object from the response.
 *
 * Phase 1: we request JSON mode and do one retry on a parse failure. The strict
 * schema validation + re-request loop (README §9) is added in Phase 3.
 */
export async function chatJSON<T>(opts: {
  model: string;
  system: string;
  user: string;
  temperature?: number;
}): Promise<T> {
  const { model, system, user, temperature = 0.2 } = opts;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await client().chat.completions.create({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const content = res.choices[0]?.message?.content ?? "";
    try {
      return JSON.parse(content) as T;
    } catch {
      if (attempt === 2) {
        throw new Error(
          `Model did not return valid JSON after 2 attempts (model: ${model}).`,
        );
      }
    }
  }
  // Unreachable, but satisfies the type checker.
  throw new Error("chatJSON: exhausted attempts");
}

/**
 * Run an async mapper over items with bounded concurrency, preserving order.
 * Keeps us from firing 50 requests at once (rate limits) without a dependency.
 */
export async function mapWithConcurrency<A, B>(
  items: A[],
  limit: number,
  fn: (item: A, index: number) => Promise<B>,
): Promise<B[]> {
  const results = new Array<B>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
