"use client";

/**
 * Client component that drives one analysis run: button → POST /api/analyze →
 * render the brief. Holds only UI state; all model work happens server-side.
 */
import { useState } from "react";
import BriefView from "./Brief";
import type { Brief } from "@/lib/types";

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; brief: Brief };

export default function BriefRunner() {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function run() {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "sample" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ phase: "error", message: data?.error ?? "Analysis failed." });
        return;
      }
      setState({ phase: "done", brief: data as Brief });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Network error.",
      });
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={run} disabled={state.phase === "loading"}>
          {state.phase === "loading"
            ? "Analyzing…"
            : state.phase === "done"
              ? "Re-run analysis"
              : "Load sample feedback"}
        </button>
        {state.phase === "idle" && (
          <span className="text-sm text-ink-subtle">
            50 sample e-commerce items · runs server-side with your OpenAI key
          </span>
        )}
      </div>

      {state.phase === "loading" && (
        <div className="nm-inset mt-5 p-5" role="status" aria-live="polite">
          <p className="text-sm font-medium text-ink">
            Classifying each item, then clustering into themes…
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            One model call per item (50) + one synthesis call. This usually takes
            10–20 seconds.
          </p>
        </div>
      )}

      {state.phase === "error" && (
        <div
          className="surface-flat mt-5 border-l-4 p-4"
          style={{ borderLeftColor: "var(--neg)" }}
          role="alert"
        >
          <p className="font-semibold text-ink">Couldn’t finish the analysis</p>
          <p className="mt-1 text-sm text-ink-muted">{state.message}</p>
        </div>
      )}

      {state.phase === "done" && (
        <div className="mt-6">
          <BriefView brief={state.brief} />
        </div>
      )}
    </div>
  );
}
