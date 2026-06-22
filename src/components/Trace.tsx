/**
 * Inspectable agent trace for ONE item: confidence, any known-issue match, the
 * model's reasoning, and the ordered steps it took (incl. tool calls). Used in
 * both the review panel and the classified-items table.
 */
import type { AnalyzedItem, TraceStep } from "@/lib/types";

const STEP_GLYPH: Record<TraceStep["type"], string> = {
  model: "◦",
  tool_call: "→",
  tool_result: "←",
  decision: "✓",
};

function ConfidenceMeter({ c }: { c: number }) {
  return (
    <span className="inline-flex items-center gap-2" title={`Confidence ${c}`}>
      <span className="text-xs font-medium text-ink-subtle">confidence</span>
      <span className="relative block h-2 w-20 overflow-hidden rounded-full bg-line">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          style={{ width: `${Math.round(c * 100)}%` }}
        />
      </span>
      <span className="font-mono text-xs text-ink tabular-nums">{c.toFixed(2)}</span>
    </span>
  );
}

export default function Trace({ item }: { item: AnalyzedItem }) {
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <ConfidenceMeter c={item.confidence} />
        {item.known_issue && (
          <span className="badge text-accent">
            Known issue: {item.known_issue.id} · {item.known_issue.status}
          </span>
        )}
      </div>

      {item.reasoning && (
        <p className="mt-2 text-ink-muted">
          <span className="font-semibold text-ink">Reasoning: </span>
          {item.reasoning}
        </p>
      )}

      <ol className="mt-3 space-y-1.5">
        {item.trace.map((s) => (
          <li key={s.step} className="flex gap-2">
            <span
              aria-hidden
              className={`mt-0.5 font-mono ${
                s.type === "decision" ? "text-accent" : "text-ink-subtle"
              }`}
            >
              {STEP_GLYPH[s.type]}
            </span>
            <span className="min-w-0">
              <span
                className={
                  s.type === "tool_call" || s.type === "tool_result"
                    ? "font-mono text-xs text-ink"
                    : "text-ink"
                }
              >
                {s.summary}
              </span>
              {s.detail && <span className="block text-xs text-ink-subtle">{s.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
