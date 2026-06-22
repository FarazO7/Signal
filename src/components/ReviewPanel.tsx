"use client";

/**
 * Human-in-the-loop review (README §6, step 8). The agent flags low-confidence
 * / novel-critical / ambiguous items; the PM resolves them here before the
 * brief is final. The PM can Approve as-is, or override the severity — which
 * feeds back into the deterministic theme scores upstream.
 */
import type { AnalyzedItem, Severity } from "@/lib/types";
import Trace from "./Trace";

const SEV: Record<Severity, string> = { 4: "Critical", 3: "High", 2: "Medium", 1: "Low" };
const SEV_CLS: Record<Severity, string> = {
  4: "text-sev-4",
  3: "text-sev-3",
  2: "text-sev-2",
  1: "text-sev-1",
};

export default function ReviewPanel({
  items,
  reviewed,
  overrides,
  onApprove,
  onApproveAll,
  onOverride,
}: {
  items: AnalyzedItem[];
  reviewed: Set<string>;
  overrides: Record<string, Severity>;
  onApprove: (id: string) => void;
  onApproveAll: () => void;
  onOverride: (id: string, severity: Severity) => void;
}) {
  const pending = items.filter((i) => !reviewed.has(i.id)).length;

  return (
    <div className="nm-raised p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">Human review</h2>
          <p className="text-sm text-ink-muted">
            The agent flagged {items.length}{" "}
            {items.length === 1 ? "item" : "items"} for your judgment ·{" "}
            <span className={pending ? "font-semibold text-sev-3" : "font-semibold text-pos"}>
              {pending ? `${pending} pending` : "all reviewed"}
            </span>
          </p>
        </div>
        <button className="btn-soft" onClick={onApproveAll} disabled={pending === 0}>
          Approve all
        </button>
      </div>

      <ul className="mt-5 space-y-3">
        {items.map((item) => {
          const isReviewed = reviewed.has(item.id);
          const sev = overrides[item.id] ?? item.classification.severity;
          const edited = overrides[item.id] != null && overrides[item.id] !== item.classification.severity;
          return (
            <li key={item.id} className="surface-flat p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-ink-subtle">
                    {item.id} · {item.channel}
                  </span>
                  <p className="mt-1 text-sm text-ink">“{item.text}”</p>
                </div>
                {isReviewed ? (
                  <span className="badge shrink-0 text-pos">Reviewed ✓</span>
                ) : (
                  <button
                    className="btn-primary shrink-0 text-sm"
                    onClick={() => onApprove(item.id)}
                  >
                    Approve
                  </button>
                )}
              </div>

              {/* Why the agent flagged it */}
              {item.flag_reason && (
                <p
                  className="mt-2 border-l-2 pl-2 text-sm text-ink-muted"
                  style={{ borderColor: "var(--sev-3)" }}
                >
                  <span className="font-semibold text-ink">Flagged: </span>
                  {item.flag_reason}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="badge text-neu">{item.classification.feature_area}</span>
                <label className="flex items-center gap-2 text-xs text-ink-subtle">
                  Severity
                  <select
                    className="nm-inset rounded-md px-2 py-1 text-sm font-medium text-ink"
                    value={sev}
                    onChange={(e) => onOverride(item.id, Number(e.target.value) as Severity)}
                  >
                    {([4, 3, 2, 1] as Severity[]).map((s) => (
                      <option key={s} value={s}>
                        {s} · {SEV[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <span className={`badge ${SEV_CLS[sev]}`}>{SEV[sev]}</span>
                {edited && <span className="text-xs font-medium text-accent">edited</span>}
              </div>

              {/* The agent's trace for this item */}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-accent">
                  Agent trace
                </summary>
                <div className="mt-2 border-l-2 border-line pl-3">
                  <Trace item={item} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
