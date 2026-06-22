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
import { z } from "zod";
import { formatZodError } from "./agent/schema";

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

/** The raw client, for the per-item agent loop (tool calling). Server-only. */
export function openaiClient(): OpenAI {
  return client();
}

export const MODELS = {
  cheap: process.env.SIGNAL_MODEL_CHEAP || "gpt-4o-mini",
  smart: process.env.SIGNAL_MODEL_SMART || "gpt-4o",
};

/**
 * Call a model and validate its JSON against a Zod schema (README §9,
 * Decision 4). On a parse OR schema violation we send the model a corrective
 * message and re-request, up to `maxAttempts`. Returns the validated data, or
 * null if it never produced schema-valid output, plus the re-request count.
 *
 * (OpenAI's native Structured Outputs is an alternative; we validate explicitly
 * here so the guardrail — and the re-request on violation — is visible in code.)
 */
export async function chatValidated<T>(opts: {
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxAttempts?: number;
}): Promise<{ data: T | null; rerequests: number }> {
  const { model, system, user, schema, temperature = 0.2, maxAttempts = 3 } = opts;
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let rerequests = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await client().chat.completions.create({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages,
    });
    const content = res.choices[0]?.message?.content ?? "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = undefined;
    }

    if (parsed !== undefined) {
      const result = schema.safeParse(parsed);
      if (result.success) return { data: result.data, rerequests };
      if (attempt < maxAttempts) {
        rerequests++;
        messages.push({ role: "assistant", content });
        messages.push({
          role: "user",
          content: `Your JSON did not match the required schema: ${formatZodError(
            result.error,
          )}. Return ONLY a corrected JSON object that matches the schema.`,
        });
        continue;
      }
    } else if (attempt < maxAttempts) {
      rerequests++;
      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: "Your reply was not valid JSON. Return ONLY a valid JSON object.",
      });
      continue;
    }
    break; // final attempt failed validation
  }

  return { data: null, rerequests };
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
