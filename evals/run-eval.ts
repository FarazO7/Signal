/**
 * Eval harness (README §7). Runs the REAL agent over the hand-labeled golden set
 * and reports the quality metrics from README §5, writing them into results.md.
 *
 * Run:  npm run eval     (needs OPENAI_API_KEY in .env)
 *
 * Integrity (README §8): the `correct_*` columns in golden_set.csv are the PM's
 * own labels. This runner treats them as ground truth and never fills them in.
 * Metrics that need labels are computed only over labeled rows; hallucination
 * rate is structural and is always computed.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeFeedback } from "../src/lib/agent/analyze";
import { MissingApiKeyError } from "../src/lib/openai";
import type { Brief, FeedbackItem } from "../src/lib/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN = join(ROOT, "evals/golden_set.csv");
const RESULTS = join(ROOT, "evals/results.md");

// ---------- tiny RFC-4180-ish CSV parser (quotes, commas, escaped "") ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

interface GoldRow {
  id: string;
  channel: string;
  text: string;
  correct_feature_area: string;
  correct_severity: string;
  correct_theme: string;
}

function loadGolden(): GoldRow[] {
  const rows = parseCsv(readFileSync(GOLDEN, "utf8"));
  const header = rows[0];
  const col = (name: string) => header.indexOf(name);
  const ci = {
    id: col("id"), channel: col("channel"), text: col("text"),
    fa: col("correct_feature_area"), sev: col("correct_severity"), th: col("correct_theme"),
  };
  return rows
    .slice(1)
    .filter((r) => r[ci.id])
    .map((r) => ({
      id: r[ci.id],
      channel: r[ci.channel],
      text: r[ci.text],
      correct_feature_area: (r[ci.fa] ?? "").trim(),
      correct_severity: (r[ci.sev] ?? "").trim(),
      correct_theme: (r[ci.th] ?? "").trim(),
    }));
}

// ---------- metrics ----------
const norm = (s: string) => s.toLowerCase().trim();
const pct = (x: number | null) => (x === null ? "— (no labels yet)" : `${Math.round(x * 100)}%`);
const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x)).length;

interface Metrics {
  labeledForCategorization: number;
  areaAgreement: number | null;
  severityAgreement: number | null;
  categorizationAgreement: number | null; // area AND severity
  labeledForThemes: number;
  themeRecall: number | null;
  themePrecision: number | null;
  hallucinationRate: number; // structural, always computed
  themeCount: number;
  themesDropped: number;
  hallucinatedRefsDropped: number;
  schemaRerequests: number;
  flaggedCount: number;
}

function computeMetrics(brief: Brief, gold: GoldRow[]): Metrics {
  const byId = new Map(brief.items.map((i) => [i.id, i]));

  // Categorization agreement (area + severity) over labeled rows.
  const catLabeled = gold.filter((g) => g.correct_feature_area && g.correct_severity);
  let area = 0, sev = 0, both = 0;
  for (const g of catLabeled) {
    const it = byId.get(g.id);
    if (!it) continue;
    const a = norm(it.classification.feature_area) === norm(g.correct_feature_area);
    const s = it.classification.severity === parseInt(g.correct_severity, 10);
    if (a) area++;
    if (s) sev++;
    if (a && s) both++;
  }

  // Theme precision/recall over rows that have a correct_theme label.
  // A human theme = a set of item ids sharing a correct_theme. Match rule: an
  // agent theme and a human theme "correspond" if they overlap ≥50% of the
  // smaller side (restricted to labeled items).
  const themed = gold.filter((g) => g.correct_theme);
  const labeledIds = new Set(themed.map((g) => g.id));
  const human = new Map<string, Set<string>>();
  for (const g of themed) {
    if (!human.has(g.correct_theme)) human.set(g.correct_theme, new Set());
    human.get(g.correct_theme)!.add(g.id);
  }
  const agent = brief.themes
    .map((t) => new Set(t.member_ids.filter((id) => labeledIds.has(id))))
    .filter((s) => s.size > 0);

  let recovered = 0;
  for (const h of human.values()) {
    if (agent.some((a) => overlap(h, a) / h.size >= 0.5)) recovered++;
  }
  let validAgent = 0;
  for (const a of agent) {
    if ([...human.values()].some((h) => overlap(h, a) / a.size >= 0.5)) validAgent++;
  }

  // Hallucination rate: themes with no member that exists in the input.
  const inputIds = new Set(brief.items.map((i) => i.id));
  const ungrounded = brief.themes.filter((t) => !t.member_ids.some((id) => inputIds.has(id))).length;

  return {
    labeledForCategorization: catLabeled.length,
    areaAgreement: catLabeled.length ? area / catLabeled.length : null,
    severityAgreement: catLabeled.length ? sev / catLabeled.length : null,
    categorizationAgreement: catLabeled.length ? both / catLabeled.length : null,
    labeledForThemes: themed.length,
    themeRecall: human.size ? recovered / human.size : null,
    themePrecision: agent.length ? validAgent / agent.length : null,
    hallucinationRate: brief.themes.length ? ungrounded / brief.themes.length : 0,
    themeCount: brief.themes.length,
    themesDropped: brief.guardrails.themes_dropped,
    hallucinatedRefsDropped: brief.guardrails.hallucinated_refs_dropped,
    schemaRerequests: brief.guardrails.schema_rerequests,
    flaggedCount: brief.flagged_count,
  };
}

// ---------- output ----------
function metricsBlock(m: Metrics, itemCount: number, ms: number): string {
  return `**Last run:** ${new Date().toISOString()} · ${itemCount} items · ${(ms / 1000).toFixed(1)}s

### Quality metrics (vs. golden set)

| Metric | Target | Actual |
|---|---|---|
| Categorization agreement (area + severity) | ≥ 85% | ${pct(m.categorizationAgreement)} |
| — feature-area agreement | — | ${pct(m.areaAgreement)} |
| — severity agreement | — | ${pct(m.severityAgreement)} |
| Theme recall | ≥ 90% | ${pct(m.themeRecall)} |
| Theme precision | ≥ 90% | ${pct(m.themePrecision)} |
| **Hallucination rate** | **0%** | ${Math.round(m.hallucinationRate * 100)}% |

_Labeled rows used: ${m.labeledForCategorization} for categorization, ${m.labeledForThemes} for themes._
_Theme match rule: an agent theme and a labeled theme correspond if they overlap ≥ 50% of the smaller side._

### Run stats

| | |
|---|---|
| Themes produced | ${m.themeCount} |
| Items flagged for review | ${m.flaggedCount} |
| Ungrounded themes dropped (grounding guardrail) | ${m.themesDropped} |
| Invented citations dropped | ${m.hallucinatedRefsDropped} |
| Schema re-requests | ${m.schemaRerequests} |
| Latency | ${(ms / 1000).toFixed(1)}s |`;
}

const TEMPLATE = (auto: string) => `# Eval results

> The block between the AUTO markers is rewritten by \`npm run eval\`. Everything
> outside the markers is hand-authored and preserved across runs.

<!-- AUTO:START -->
${auto}
<!-- AUTO:END -->

## Failure-mode analysis (hand-authored)

| Failure observed | Why it happened | What I changed | Result |
|---|---|---|---|
| _e.g. over-merged "slow loading" and "app crashes"_ | _prompt didn't separate performance vs. stability_ | _added a theme-separation rule + example_ | _stability recall improved_ |

## Iteration log

_Narrative: v1 did X poorly → hypothesized Y → changed Z → re-measured._
`;

function writeResults(auto: string) {
  if (existsSync(RESULTS)) {
    const cur = readFileSync(RESULTS, "utf8");
    const start = cur.indexOf("<!-- AUTO:START -->");
    const end = cur.indexOf("<!-- AUTO:END -->");
    if (start !== -1 && end !== -1) {
      const next =
        cur.slice(0, start) + `<!-- AUTO:START -->\n${auto}\n` + cur.slice(end);
      writeFileSync(RESULTS, next);
      return;
    }
  }
  writeFileSync(RESULTS, TEMPLATE(auto));
}

async function main() {
  const gold = loadGolden();
  const items: FeedbackItem[] = gold.map((g) => ({
    id: g.id, channel: g.channel, date: "", rating: null, text: g.text,
  }));
  console.log(`Running the agent over ${items.length} golden-set items…\n`);

  const t0 = Date.now();
  const brief = await analyzeFeedback(items);
  const ms = Date.now() - t0;

  const m = computeMetrics(brief, gold);

  // Console summary
  console.log("Quality metrics (vs. golden set)");
  console.log(`  Categorization agreement (area+sev): ${pct(m.categorizationAgreement)}  [target ≥85%]`);
  console.log(`    · feature-area: ${pct(m.areaAgreement)}   · severity: ${pct(m.severityAgreement)}`);
  console.log(`  Theme recall:    ${pct(m.themeRecall)}  [target ≥90%]`);
  console.log(`  Theme precision: ${pct(m.themePrecision)}  [target ≥90%]`);
  console.log(`  Hallucination rate: ${Math.round(m.hallucinationRate * 100)}%  [target 0%]`);
  console.log("\nRun stats");
  console.log(`  themes ${m.themeCount} · flagged ${m.flaggedCount} · dropped-themes ${m.themesDropped} · invented-cites ${m.hallucinatedRefsDropped} · re-requests ${m.schemaRerequests} · ${(ms / 1000).toFixed(1)}s`);

  if (m.categorizationAgreement === null && m.themeRecall === null) {
    console.log(
      "\nNote: no `correct_*` labels filled in yet — only the hallucination rate and run stats are meaningful.\nFill the correct_* columns in evals/golden_set.csv to get agreement / precision / recall.",
    );
  }

  writeResults(metricsBlock(m, items.length, ms));
  console.log(`\nWrote ${RESULTS}`);
}

main().catch((err) => {
  if (err instanceof MissingApiKeyError) {
    console.error("\n✗ " + err.message);
    process.exit(1);
  }
  console.error("\n✗ Eval failed:", err);
  process.exit(1);
});
