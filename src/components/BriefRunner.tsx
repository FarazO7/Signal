"use client";

/**
 * Drives one analysis run and the human-in-the-loop review:
 *   button → POST /api/analyze → review flagged items → finalized brief.
 *
 * Severity overrides from the review feed back into the deterministic theme
 * scores via the shared scoring helper (no formula duplicated). All model work
 * happens server-side; this holds only UI/review state.
 */
import { useMemo, useState } from "react";
import BriefView from "./Brief";
import ReviewPanel from "./ReviewPanel";
import { aggregateSeverities } from "@/lib/scoring";
import type { Brief, Severity } from "@/lib/types";

type Status = "idle" | "loading" | "error" | "done";

export default function BriefRunner() {
  const [status, setStatus] = useState<Status>("idle");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, Severity>>({});

  async function run() {
    setStatus("loading");
    setReviewed(new Set());
    setOverrides({});
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "sample" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error ?? "Analysis failed.");
        setStatus("error");
        return;
      }
      setBrief(data as Brief);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error.");
      setStatus("error");
    }
  }

  const flaggedItems = useMemo(
    () => (brief ? brief.items.filter((i) => i.flagged) : []),
    [brief],
  );

  const finalized =
    flaggedItems.length === 0 || flaggedItems.every((i) => reviewed.has(i.id));

  // Apply severity overrides and recompute theme scores from the data.
  const effectiveBrief = useMemo<Brief | null>(() => {
    if (!brief) return null;
    const sevById = new Map(
      brief.items.map((i) => [i.id, overrides[i.id] ?? i.classification.severity]),
    );
    const items = brief.items.map((i) => ({
      ...i,
      classification: { ...i.classification, severity: sevById.get(i.id)! },
    }));
    const themes = brief.themes
      .map((t) => ({
        ...t,
        ...aggregateSeverities(t.member_ids.map((id) => sevById.get(id)!)),
      }))
      .sort((a, b) => b.score - a.score);
    return { ...brief, items, themes };
  }, [brief, overrides]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={run} disabled={status === "loading"}>
          {status === "loading"
            ? "Analyzing…"
            : status === "done"
              ? "Re-run analysis"
              : "Load sample feedback"}
        </button>
        {status === "idle" && (
          <span className="text-sm text-ink-subtle">
            50 sample e-commerce items · runs server-side with your OpenAI key
          </span>
        )}
      </div>

      {status === "loading" && (
        <div className="nm-inset mt-5 p-5" role="status" aria-live="polite">
          <p className="text-sm font-medium text-ink">
            Running the agent on each item, then clustering into themes…
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Each item is classified and may call the lookup_known_issues tool;
            low-confidence ones get flagged for your review. Usually ~20–40
            seconds for 50 items.
          </p>
        </div>
      )}

      {status === "error" && (
        <div
          className="surface-flat mt-5 border-l-4 p-4"
          style={{ borderLeftColor: "var(--neg)" }}
          role="alert"
        >
          <p className="font-semibold text-ink">Couldn’t finish the analysis</p>
          <p className="mt-1 text-sm text-ink-muted">{errorMsg}</p>
        </div>
      )}

      {status === "done" && effectiveBrief && (
        <div className="mt-6 space-y-6">
          {flaggedItems.length > 0 && (
            <ReviewPanel
              items={flaggedItems}
              reviewed={reviewed}
              overrides={overrides}
              onApprove={(id) => setReviewed((p) => new Set(p).add(id))}
              onApproveAll={() => setReviewed(new Set(flaggedItems.map((i) => i.id)))}
              onOverride={(id, severity) =>
                setOverrides((p) => ({ ...p, [id]: severity }))
              }
            />
          )}
          <BriefView brief={effectiveBrief} finalized={finalized} />
        </div>
      )}
    </div>
  );
}
