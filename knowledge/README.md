# whichFly Knowledge Layer

This folder contains curated knowledge used to ground the LLM safely.

## Key principles
- We store **summaries**, not copied text.
- Snippets are **background only**, never factual claims.
- The LLM must still comply with:
  - contracts/by_the_riverside.schema.json
  - docs/FLY_ALLOWLIST.md
  - docs/LLM_GUARDRAILS_TESTS.md
- Allowlist enforcement is controlled by `ALLOWLIST_ENFORCEMENT` (default off).
- Snippets are validated against the river dataset at load time (fail fast on unknown/ambiguous rivers).

## Structure
- `snippets/` — semi-structured curated summaries with metadata
- (future) `heuristics/` — structured rules and stable guidance
