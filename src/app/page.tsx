/**
 * Phase 0 — styled shell only. No agent logic yet.
 *
 * This page stands up the application chrome (header, hero, footer) and doubles
 * as a live reference for the design system: it renders every neumorphic
 * primitive and every flat/dense primitive the real app will use, so the look
 * can be reviewed before any logic is wired in (Phases 1+).
 */

// The seven steps of the agent loop (README §6). Rendered here as static chrome.
const FLOW = [
  { n: 1, title: "Ingest & normalize", desc: "Clean and de-duplicate the raw batch." },
  { n: 2, title: "Per-item analysis", desc: "Classify area, sentiment, severity; extract the core ask." },
  { n: 3, title: "Context tool", desc: "Agent decides when to call lookup_known_issues." },
  { n: 4, title: "Confidence + review", desc: "Low-confidence items are flagged for a human." },
  { n: 5, title: "Cluster into themes", desc: "Group items; count frequency, aggregate severity." },
  { n: 6, title: "Prioritize", desc: "Explainable score: frequency × severity, formula visible." },
  { n: 7, title: "Grounded brief", desc: "Every theme cites the real quotes that back it." },
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      {/* ---------- Header ---------- */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Neumorphic "signal" mark */}
          <span aria-hidden className="nm-raised-sm grid h-11 w-11 place-items-center">
            <span className="flex items-end gap-[3px]">
              <i className="block w-[3px] rounded-sm bg-accent" style={{ height: 8 }} />
              <i className="block w-[3px] rounded-sm bg-accent" style={{ height: 14 }} />
              <i className="block w-[3px] rounded-sm bg-accent" style={{ height: 20 }} />
            </span>
          </span>
          <div>
            <p className="text-lg font-bold tracking-tight text-ink">Signal</p>
            <p className="text-xs text-ink-subtle">feedback noise → prioritized roadmap</p>
          </div>
        </div>
        <span className="badge text-accent">Phase 0 · scaffold + design system</span>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="mt-10">
        <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
          Turn hundreds of scattered, messy feedback items into an
          evidence-backed, prioritized roadmap brief.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-ink-muted">
          An AI agent reads every item through the same lens, clusters the
          signal into themes, and ranks them by frequency and severity — with
          every recommendation traceable to the exact feedback that supports it,
          and a human-in-the-loop checkpoint before anything is finalized.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {/* Primary action: FLAT + filled accent (guardrail). Disabled until Phase 1. */}
          <button className="btn-primary" disabled title="Wired up in Phase 1">
            Load sample feedback
          </button>
          <button className="btn-soft" disabled title="Wired up in Phase 1">
            View the eval harness
          </button>
        </div>
      </section>

      {/* ---------- Agent flow (neumorphic cards) ---------- */}
      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
          How the agent will work
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FLOW.map((s) => (
            <li key={s.n} className="nm-raised-sm p-5">
              <div className="flex items-center gap-3">
                <span className="nm-inset grid h-8 w-8 place-items-center text-sm font-bold text-accent">
                  {s.n}
                </span>
                <h3 className="font-semibold text-ink">{s.title}</h3>
              </div>
              <p className="mt-2 text-sm text-ink-muted">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Design-system preview ---------- */}
      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
          Design system preview
        </h2>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {/* Neumorphic controls + badges */}
          <div className="nm-raised p-6">
            <p className="text-sm font-semibold text-ink">Surfaces, controls &amp; badges</p>
            <p className="mt-1 text-sm text-ink-muted">
              Soft skin for chrome; color + label always travel together.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button className="btn-primary">Primary</button>
              <button className="btn-soft">Secondary</button>
              <button className="btn-soft" data-pressed="true">
                Selected
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="badge text-sev-4">● Critical</span>
              <span className="badge text-sev-3">● High</span>
              <span className="badge text-sev-2">● Medium</span>
              <span className="badge text-sev-1">● Low</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge text-pos">▲ Positive</span>
              <span className="badge text-neu">■ Neutral</span>
              <span className="badge text-neg">▼ Negative</span>
            </div>

            <div className="nm-inset mt-5 p-4">
              <p className="text-xs text-ink-subtle">Inset / pressed panel</p>
              <p className="text-sm text-ink-muted">
                Used for input wells and selected states.
              </p>
            </div>
          </div>

          {/* FLAT surface for dense data (guardrail: tables are NOT neumorphic) */}
          <div className="surface-flat overflow-hidden">
            <div className="border-b border-line px-5 py-3">
              <p className="text-sm font-semibold text-ink">Dense data → flat surface</p>
              <p className="text-xs text-ink-subtle">
                High contrast, no soft shadows, for readability.
              </p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-subtle">
                <tr className="border-b border-line">
                  <th className="px-5 py-2 font-semibold">Theme (example)</th>
                  <th className="px-3 py-2 font-semibold">Count</th>
                  <th className="px-3 py-2 font-semibold">Severity</th>
                </tr>
              </thead>
              <tbody className="text-ink-muted">
                {(
                  [
                    ["Checkout fails on saved cards", 23, "Critical", "text-sev-4"],
                    ["Search returns irrelevant items", 14, "High", "text-sev-3"],
                    ["Slow image loading on PLP", 9, "Medium", "text-sev-2"],
                    ["Wishlist copy is confusing", 4, "Low", "text-sev-1"],
                  ] as const
                ).map(([name, count, sev, cls]) => (
                  <tr key={name} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-2.5 text-ink">{name}</td>
                    <td className="px-3 py-2.5 tabular-nums">{count}</td>
                    <td className="px-3 py-2.5">
                      <span className={`badge ${cls}`}>{sev}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 py-3 text-xs text-ink-subtle">
              Sample rows — real data is wired in Phase 1.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="mt-14 border-t border-line pt-6 text-sm text-ink-subtle">
        <p>
          Signal · decision-support, not a decision-maker. Next.js + TypeScript +
          Tailwind. The agent runs server-side; the OpenAI key stays server-only.
        </p>
      </footer>
    </div>
  );
}
