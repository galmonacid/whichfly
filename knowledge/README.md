# whichFly Knowledge Layer

This folder contains curated knowledge used to ground the LLM safely.

## Key principles
- We store **summaries**, not copied text.
- Snippets are **background only**, never factual claims.
- The LLM must still comply with:
  - contracts/right_now.schema.json
  - docs/FLY_ALLOWLIST.md
  - docs/LLM_GUARDRAILS_TESTS.md

## Structure
- `snippets/` — semi-structured curated summaries with metadata
- (future) `heuristics/` — structured rules and stable guidance
