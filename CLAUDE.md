# CLAUDE.md — Signal

Project conventions and run instructions for this repo. The product spec is
[`README.md`](README.md) (the PRD) — read it for *what* and *why*; this file is
*how we build it*.

> **Next.js 16 note:** this repo uses Next.js 16, which has breaking changes vs.
> older versions. See [`AGENTS.md`](AGENTS.md) and prefer the docs in
> `node_modules/next/dist/docs/` over training-data assumptions.

## What this is

**Signal** — an agentic AI tool that turns a batch of raw user feedback into a
prioritized, evidence-backed roadmap brief. Decision-**support**, not automation:
the agent proposes, a human disposes. Domain for the sample data: a general
direct-to-consumer **e-commerce** store.

## Stack (overrides the PRD's original Streamlit/Python)

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4**, one codebase.
- The **agent runs server-side** in API routes / server code (TypeScript).
- **LLM:** OpenAI API, model **configurable** via env (`SIGNAL_MODEL_CHEAP`,
  `SIGNAL_MODEL_SMART`) so it's easy to swap. Cheap model for simple
  classification, capable model for synthesis + low-confidence cases.
- **Storage:** JSON files in `data/` (known-issues store + sample feedback). No DB.
- **Agent loop is hand-rolled** — no heavy agent framework (so it's explainable).
- **Deploy:** Vercel.

## Secrets (web-app critical)

- The OpenAI key lives **only server-side**, read from `.env`. It must **never**
  appear in client components or be shipped to the browser.
- `.env` is gitignored; `.env.example` is the committed template.
- Anything reading the key must be server-only (API route, server action, or the
  eval runner) — never a `"use client"` module.

## Run

```bash
npm install          # install deps
cp .env.example .env # then paste your OPENAI_API_KEY into .env
npm run dev          # start the dev server (http://localhost:3000)
npm run build        # production build
npm run lint         # eslint
# npm run eval       # eval harness (added in Phase 4)
```

## Conventions

- **Readable over clever.** This is a portfolio piece owned by a PM; favor code
  that can be explained in an interview over abstractions that can't.
- **Comment the *why*,** especially on agent decisions (tool calls, confidence,
  flagging) and guardrails (grounding, schema validation).
- **Design system:** [`design-system/MASTER.md`](design-system/MASTER.md) is the
  source of truth; it's implemented in [`src/app/globals.css`](src/app/globals.css).
  Use the documented primitives (`.nm-raised`, `.btn-primary`, `.badge`, …) and
  honor the accessibility guardrails (flat primary buttons, `:focus-visible`,
  never shadow-only state, flat surfaces for dense data).
- **Prompts are product.** When added, agent prompts live in
  `src/lib/agent/prompts.ts`, version-controlled and diffable.
- **Structured output + grounding** are non-negotiable (README §8, §9): enforce a
  schema on every model response (re-request on violation), and every theme in
  the brief must cite ≥1 real source quote or it's dropped.

## Build phases (per the kickoff)

0. ✅ Scaffold + design system + sample data (this commit)
1. End-to-end skeleton — classify each item → rough themes → basic brief
2. Real agent — `lookup_known_issues` tool, confidence scoring, human-in-the-loop,
   inspectable agent-trace view
3. Guardrails — grounding (cite-or-drop) + enforced structured output
4. Evaluation — golden-set runner + metrics + `results.md`
5. Polish + accessibility QA + Vercel deploy
6. (Optional) graphify architecture artifact

Work one phase at a time; keep it runnable at each; pause for review between phases.
