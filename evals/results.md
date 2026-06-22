# Eval results

> The block between the AUTO markers is rewritten by `npm run eval`. Everything
> outside the markers is hand-authored and preserved across runs.
>
> Golden set: [`golden_set.csv`](golden_set.csv) — 30 items. The `correct_*`
> columns are the PM's own labels (ground truth); fill them in to get the
> agreement / precision / recall numbers. Hallucination rate needs no labels.

<!-- AUTO:START -->
**Last run:** _not run yet — `npm run eval` (needs OPENAI_API_KEY in .env)_
<!-- AUTO:END -->

## Failure-mode analysis (hand-authored)

| Failure observed | Why it happened | What I changed | Result |
|---|---|---|---|
| _e.g. over-merged "slow loading" and "app crashes"_ | _prompt didn't separate performance vs. stability_ | _added a theme-separation rule + example_ | _stability recall improved_ |

## Iteration log

_Narrative: v1 did X poorly → hypothesized Y → changed Z → re-measured._
