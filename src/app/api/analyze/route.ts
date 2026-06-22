/**
 * POST /api/analyze — run the agent over a feedback batch and return a Brief.
 *
 * Runs SERVER-SIDE only: this is where the OpenAI key is used. The browser
 * never sees it. Body:
 *   { "source": "sample" }            → analyze the bundled sample feedback
 *   { "items": FeedbackItem[] }       → analyze a provided batch
 */
import { NextResponse } from "next/server";
import { analyzeFeedback } from "@/lib/agent/analyze";
import { sampleFeedback } from "@/lib/data";
import { MissingApiKeyError } from "@/lib/openai";
import type { FeedbackItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60; // classifying ~50 items can take 10–20s

export async function POST(req: Request) {
  let body: { source?: string; items?: FeedbackItem[] } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — default to the sample
  }

  const items =
    Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : sampleFeedback;

  try {
    const brief = await analyzeFeedback(items);
    return NextResponse.json(brief);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[/api/analyze] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed." },
      { status: 500 },
    );
  }
}
