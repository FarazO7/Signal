# Graph Report - .  (2026-06-22)

## Corpus Check
- Corpus is ~6,688 words - fits in a single context window. You may not need a graph.

## Summary
- 78 nodes · 161 edges · 6 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Brief UI & scoring|Brief UI & scoring]]
- [[_COMMUNITY_Types, review & trace|Types, review & trace]]
- [[_COMMUNITY_Agent loop & tools|Agent loop & tools]]
- [[_COMMUNITY_OpenAI client & schemas|OpenAI client & schemas]]
- [[_COMMUNITY_Synthesis pipeline & API|Synthesis pipeline & API]]
- [[_COMMUNITY_App shell & layout|App shell & layout]]

## God Nodes (most connected - your core abstractions)
1. `analyzeItemWithAgent()` - 8 edges
2. `analyzeFeedback()` - 7 edges
3. `FeedbackItem` - 7 edges
4. `Severity` - 7 edges
5. `formatZodError()` - 5 edges
6. `chatValidated()` - 5 edges
7. `aggregateSeverities()` - 5 edges
8. `AnalyzedItem` - 5 edges
9. `ItemAnalysis` - 4 edges
10. `openaiClient()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `analyzeFeedback()`  [EXTRACTED]
  src/app/api/analyze/route.ts → src/lib/agent/analyze.ts
- `buildTheme()` --calls--> `aggregateSeverities()`  [EXTRACTED]
  src/lib/agent/analyze.ts → src/lib/scoring.ts
- `analyzeFeedback()` --calls--> `chatValidated()`  [EXTRACTED]
  src/lib/agent/analyze.ts → src/lib/openai.ts
- `analyzeItemWithAgent()` --calls--> `formatZodError()`  [EXTRACTED]
  src/lib/agent/loop.ts → src/lib/agent/schema.ts
- `analyzeItemWithAgent()` --calls--> `openaiClient()`  [EXTRACTED]
  src/lib/agent/loop.ts → src/lib/openai.ts

## Import Cycles
- None detected.

## Communities (6 total, 0 thin omitted)

### Community 0 - "Brief UI & scoring"
Cohesion: 0.15
Nodes (10): FLOW, SENT, SEV, Status, aggregateSeverities(), round2(), ThemeAggregate, Brief (+2 more)

### Community 1 - "Types, review & trace"
Cohesion: 0.18
Nodes (10): ItemAnalysis, SEV, SEV_CLS, STEP_GLYPH, AnalyzedItem, BriefGuardrails, Classification, FeedbackItem (+2 more)

### Community 2 - "Agent loop & tools"
Cohesion: 0.27
Nodes (10): analyzeItemWithAgent(), decideFlag(), SENTIMENTS, tryParse(), classifyUser(), LOOKUP_TOOL, LookupResult, runLookup() (+2 more)

### Community 3 - "OpenAI client & schemas"
Cohesion: 0.21
Nodes (10): ClassificationOut, ClassificationSchema, formatZodError(), SynthesisOut, SynthesisSchema, chatValidated(), client(), MissingApiKeyError (+2 more)

### Community 4 - "Synthesis pipeline & API"
Cohesion: 0.27
Nodes (10): analyzeFeedback(), AssembleResult, assembleThemes(), buildTheme(), RawTheme, synthesizeUser(), POST(), sampleFeedback (+2 more)

### Community 5 - "App shell & layout"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

## Knowledge Gaps
- **16 isolated node(s):** `geistSans`, `geistMono`, `metadata`, `FLOW`, `SEV` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Severity` connect `Brief UI & scoring` to `Types, review & trace`, `Agent loop & tools`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `MissingApiKeyError` connect `OpenAI client & schemas` to `Synthesis pipeline & API`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `aggregateSeverities()` connect `Brief UI & scoring` to `Synthesis pipeline & API`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `geistSans`, `geistMono`, `metadata` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._