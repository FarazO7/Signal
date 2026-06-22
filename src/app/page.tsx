/**
 * Phase 1 — end-to-end skeleton.
 *
 * Header + hero are static chrome (server component). The live app is the
 * <BriefRunner/> client component: load sample feedback → classify each item →
 * synthesize themes → render a basic prioritized brief. Tools, confidence, and
 * the agent-trace view arrive in Phase 2.
 */
import BriefRunner from "@/components/BriefRunner";

// The seven steps of the agent loop (README §6). Steps 3–4 land in Phase 2.
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
        <span className="badge text-accent">Phase 1 · end-to-end skeleton</span>
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
          every recommendation traceable to the exact feedback that supports it.
        </p>
      </section>

      {/* ---------- The live app ---------- */}
      <section className="mt-8">
        <BriefRunner />
      </section>

      {/* ---------- Agent flow (neumorphic cards) ---------- */}
      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
          How the agent works
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
