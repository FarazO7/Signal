/**
 * Structured-output schemas (README §9, Decision 4). Every model response is
 * validated against one of these; a violation triggers a re-request rather than
 * being silently mishandled. Zod is a validation library (not an agent
 * framework) — small and easy to explain.
 */
import { z } from "zod";

export const ClassificationSchema = z.object({
  feature_area: z.string().min(1),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  severity: z.number().int().min(1).max(4),
  core_ask: z.string().min(1),
  confidence: z.number().min(0).max(1),
  known_issue_id: z.string().nullable(),
  reasoning: z.string().min(1),
});
export type ClassificationOut = z.infer<typeof ClassificationSchema>;

export const SynthesisSchema = z.object({
  themes: z.array(
    z.object({
      label: z.string().min(1),
      feature_area: z.string().min(1),
      suggested_action: z.string().min(1),
      member_ids: z.array(z.string()).min(1),
    }),
  ),
});
export type SynthesisOut = z.infer<typeof SynthesisSchema>;

/** Compact, human-readable validation error for the corrective re-request. */
export function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}
