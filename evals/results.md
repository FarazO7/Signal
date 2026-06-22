# Eval results

> Auto-written by the eval runner (built in Phase 4) and annotated by hand.
> Until then, this is the template the runner fills in.

**Golden set:** [`golden_set.csv`](golden_set.csv) — 30 items, hand-labeled by the PM.
**How to run:** `npm run eval` (added in Phase 4).
**Last run:** _not run yet_

---

## Quality metrics (vs. golden set)

| Metric | Target | Actual |
|---|---|---|
| Categorization agreement (area + severity) | ≥ 85% | _TBD_ |
| Theme recall | ≥ 90% | _TBD_ |
| Theme precision | ≥ 90% | _TBD_ |
| **Hallucination rate** (themes not traceable to a source item) | **0%** | _TBD_ |

## Trust & efficiency

| Metric | Target | Actual |
|---|---|---|
| Review-flag precision | ≥ 60% | _TBD_ |
| Cost per run | < $TBD | _TBD_ |
| Latency per run (30 items) | < TBD min | _TBD_ |

---

## Failure-mode analysis

Documented after the first real run. Format:

| Failure observed | Why it happened | What I changed | Result |
|---|---|---|---|
| _e.g. over-merged "slow loading" and "app crashes"_ | _prompt didn't separate performance vs. stability_ | _added theme-separation rule + example_ | _stability recall improved_ |

## Iteration log

_Narrative: v1 did X poorly → hypothesized Y → changed Z → re-measured._
