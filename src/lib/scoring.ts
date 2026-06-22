/**
 * Pure scoring helpers — no server-only imports, so BOTH the server pipeline
 * and the client review panel can use them. This keeps the explainable
 * priority formula (README Decision 6) defined in exactly one place.
 */
import type { Severity } from "./types";

export interface ThemeAggregate {
  count: number;
  max_severity: Severity;
  avg_severity: number;
  /** Explainable priority = frequency × average severity. */
  score: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function aggregateSeverities(severities: number[]): ThemeAggregate {
  const count = severities.length;
  const max_severity = Math.max(...severities) as Severity;
  const avg_severity = round2(severities.reduce((s, v) => s + v, 0) / count);
  return { count, max_severity, avg_severity, score: round2(count * avg_severity) };
}
