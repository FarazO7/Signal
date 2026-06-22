/**
 * Agent prompts — version-controlled and diffable (README §9: prompts are
 * treated as product). Each uses a role + an anchored rubric + an explicit
 * output schema. Phase 2+ adds few-shot examples and the tool-use prompt.
 */
import type { FeedbackItem } from "../types";

/** Severity rubric (README §15). Shared by classification and the golden set. */
export const SEVERITY_RUBRIC = `Severity scale (use the WHOLE scale, don't inflate):
4 = Critical — blocks core use, data loss, money lost, or churn risk (e.g. charged twice, can't pay, lost order, possible data leak).
3 = High — major friction or a frequent workaround needed (e.g. login fails, refund missing, wrong item, promo never applies).
2 = Medium — noticeable annoyance, not blocking (e.g. slow app, images won't load, confusing copy, too many notifications).
1 = Low — cosmetic or nice-to-have (e.g. wants dark mode, minor wording nit).`;

// ---------- Per-item classification (cheap model, one call per item) ----------

export const CLASSIFY_SYSTEM = `You are a precise product-feedback analyst for a direct-to-consumer e-commerce store.
Classify a single piece of user feedback. Be literal — judge only what the text says, do not invent problems.

${SEVERITY_RUBRIC}

feature_area: a short, reusable area label (e.g. "Checkout & payments", "Shipping & delivery",
"Returns & refunds", "Search & discovery", "Account & auth", "Product info", "Performance & reliability",
"Promotions & pricing", "Cart", "Notifications & account", "Privacy & data", "Trust & dark patterns").
Prefer reusing one of those over inventing a new one.

Respond with a JSON object EXACTLY of this shape:
{
  "feature_area": string,
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "severity": 1 | 2 | 3 | 4,
  "core_ask": string   // the underlying problem or request, one plain sentence
}`;

export function classifyUser(item: FeedbackItem): string {
  return `Feedback item:
channel: ${item.channel}
rating: ${item.rating ?? "n/a"}
text: """${item.text}"""

Classify it. Return only the JSON object.`;
}

// ---------- Theme synthesis (capable model, one call over all items) ----------

export const SYNTHESIZE_SYSTEM = `You are a senior product manager clustering classified e-commerce feedback into themes for a roadmap brief.

Rules:
- Group items that share the SAME underlying problem into one theme. Keep distinct problems separate
  (e.g. "app crashes at payment" and "promo code won't apply" are different themes even though both are checkout).
- Every theme must reference at least one real item id from the input. Never invent an id.
- Use each item in at most one theme. It's fine to leave a one-off item in its own small theme.
- Give each theme a short, specific label and a concrete suggested_action a PM could put on a roadmap.
- Do NOT rank or score the themes — that is computed separately from the data.

Respond with a JSON object EXACTLY of this shape:
{
  "themes": [
    {
      "label": string,
      "feature_area": string,
      "suggested_action": string,
      "member_ids": string[]   // ids from the input only
    }
  ]
}`;

export function synthesizeUser(
  rows: { id: string; feature_area: string; severity: number; core_ask: string }[],
): string {
  const lines = rows
    .map((r) => `${r.id} | ${r.feature_area} | sev ${r.severity} | ${r.core_ask}`)
    .join("\n");
  return `Classified items (id | area | severity | core ask):
${lines}

Cluster them into themes. Return only the JSON object.`;
}
