/**
 * Loads the bundled sample data. JSON is imported (not read from disk at
 * runtime) so it's reliably included in the Vercel build output.
 *
 * Server-only — keep these imports out of client components.
 */
import sampleFeedbackJson from "../../data/sample_feedback.json";
import knownIssuesJson from "../../data/known_issues.json";
import type { FeedbackItem } from "./types";

export interface KnownIssue {
  id: string;
  title: string;
  area: string;
  status: string;
  severity: number;
  first_seen: string;
  summary: string;
  keywords: string[];
}

export const sampleFeedback = sampleFeedbackJson as FeedbackItem[];
export const knownIssues = knownIssuesJson as KnownIssue[];
