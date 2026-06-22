/**
 * Presentational view of a Brief. No data fetching here — it just renders.
 * Dense content (theme details, the raw-items table) uses FLAT surfaces per the
 * design system; neumorphism is reserved for chrome (rank chips, the page).
 */
import type { Brief, Severity, Sentiment } from "@/lib/types";

const SEV: Record<Severity, { label: string; cls: string }> = {
  4: { label: "Critical", cls: "text-sev-4" },
  3: { label: "High", cls: "text-sev-3" },
  2: { label: "Medium", cls: "text-sev-2" },
  1: { label: "Low", cls: "text-sev-1" },
};

const SENT: Record<Sentiment, { label: string; cls: string }> = {
  positive: { label: "Positive", cls: "text-pos" },
  negative: { label: "Negative", cls: "text-neg" },
  neutral: { label: "Neutral", cls: "text-neu" },
  mixed: { label: "Mixed", cls: "text-neu" },
};

function SeverityBadge({ s }: { s: Severity }) {
  return <span className={`badge ${SEV[s].cls}`}>{SEV[s].label}</span>;
}

export default function BriefView({ brief }: { brief: Brief }) {
  const byId = new Map(brief.items.map((i) => [i.id, i]));

  return (
    <div>
      {/* Summary */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold tracking-tight text-ink">
          Prioritized roadmap brief
        </h2>
        <p className="text-xs text-ink-subtle">
          {brief.item_count} items · {brief.themes.length} themes ·{" "}
          {new Date(brief.generated_at).toLocaleString()}
        </p>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Ranked by an explainable score —{" "}
        <span className="font-mono text-ink">frequency × average severity</span>.
        Every theme lists the real feedback behind it.
      </p>

      {/* Themes */}
      <ol className="mt-5 space-y-3">
        {brief.themes.map((t, i) => (
          <li key={t.label + i} className="surface-flat p-4">
            <div className="flex items-start gap-3">
              <span className="nm-inset grid h-8 w-8 shrink-0 place-items-center text-sm font-bold text-accent">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="font-semibold text-ink">{t.label}</h3>
                  <span className="text-xs text-ink-subtle">{t.feature_area}</span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="badge text-accent">
                    {t.count} {t.count === 1 ? "report" : "reports"}
                  </span>
                  <SeverityBadge s={t.max_severity} />
                  <span className="badge text-neu" title="frequency × average severity">
                    score {t.score}
                  </span>
                </div>

                {t.suggested_action && (
                  <p className="mt-2 text-sm text-ink-muted">
                    <span className="font-semibold text-ink">Suggested action: </span>
                    {t.suggested_action}
                  </p>
                )}

                {/* Evidence — native disclosure (keyboard-accessible) */}
                <details className="mt-2 group">
                  <summary className="cursor-pointer text-sm font-medium text-accent">
                    Evidence ({t.member_ids.length})
                  </summary>
                  <ul className="mt-2 space-y-2 border-l-2 border-line pl-3">
                    {t.member_ids.map((id) => {
                      const it = byId.get(id);
                      if (!it) return null;
                      return (
                        <li key={id} className="text-sm">
                          <span className="font-mono text-xs text-ink-subtle">
                            {it.id} · {it.channel}
                          </span>
                          <p className="text-ink-muted">“{it.text}”</p>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Raw classified items — the "watch raw feedback become a brief" view */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-semibold text-ink-muted">
          Show all {brief.item_count} classified items
        </summary>
        <div className="surface-flat mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-subtle">
              <tr className="border-b border-line">
                <th className="px-3 py-2 font-semibold">ID</th>
                <th className="px-3 py-2 font-semibold">Area</th>
                <th className="px-3 py-2 font-semibold">Sentiment</th>
                <th className="px-3 py-2 font-semibold">Sev</th>
                <th className="px-3 py-2 font-semibold">Core ask</th>
              </tr>
            </thead>
            <tbody className="text-ink-muted">
              {brief.items.map((it) => (
                <tr key={it.id} className="border-b border-line/70 last:border-0 align-top">
                  <td className="px-3 py-2 font-mono text-xs text-ink">{it.id}</td>
                  <td className="px-3 py-2">{it.classification.feature_area}</td>
                  <td className="px-3 py-2">
                    <span className={`badge ${SENT[it.classification.sentiment].cls}`}>
                      {SENT[it.classification.sentiment].label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <SeverityBadge s={it.classification.severity} />
                  </td>
                  <td className="px-3 py-2">{it.classification.core_ask}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
