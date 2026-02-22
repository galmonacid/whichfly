# Knowledge Strategy — whichFly

This document defines how whichFly stores and uses non-structured knowledge to ground the LLM safely.

whichFly is **LLM-first with strict guardrails**. Grounding exists to improve relevance and reduce hallucinations,
not to create "facts" about rivers or hatches.

---

## Goals

- Provide additional context to the LLM without creating false certainty.
- Keep knowledge **reviewable, versioned, and safe**.
- Avoid copyright issues by storing **summaries**, not copied text.
- Improve over time using aggregated user feedback.

---

## What grounding is (and is not)

### Grounding IS
- Curated background context (e.g., seasonal tendencies, general river-type behaviour).
- Weak signals from anglers’ reports expressed as **tentative** (“often”, “can help”, “worth trying”).
- Constraints (allowlist patterns) and safe priors.

### Grounding IS NOT
- A source of truth about exact hatches occurring on a given day.
- A replacement for current conditions (weather/daylight/water level).
- A place to store verbatim forum posts or long extracts.

---

## Data types

### 1) Heuristics (structured, stable)
- Format: YAML/JSON
- Examples:
  - “High water often reduces surface reliability”
  - “In cold water start subsurface”
- These can be used as deterministic guardrails.

### 2) Snippets (curated summaries, semi-structured)
- Format: JSON files under `knowledge/snippets/*.json`
- Each snippet includes:
  - scope (region/river/season/river_type)
  - summary (paraphrase, 1–2 sentences)
  - confidence (usually low)
  - tags
  - sources (internal references only, no quotes)

---

## Licensing & copyright policy

- Do **not** store copied text from blogs/forums/books.
- Do **not** store long quotes.
- Store:
  - your own paraphrases
  - aggregated takeaways
  - short neutral summaries

Sources should be tracked as internal references (e.g., “internal_note_001”), not republished text.

---

## Runtime usage rules (non-negotiable)

When grounding snippets are provided to the LLM:

- Snippets must be framed as **background only**.
- The LLM must not present snippet content as factual claims.
- The LLM must not claim specific hatches or local facts.
- If grounding conflicts with current conditions, **prefer current conditions**.

All LLM outputs still must validate against:
- `contracts/by_the_riverside.schema.json`
- `docs/FLY_ALLOWLIST.md`
- `docs/LLM_GUARDRAILS_TESTS.md`

---

## Snippet selection rules

Snippets are selected **deterministically** (no embeddings, no semantic search).

1. **Scope filter (hard filter)**
   - country == UK
   - `scope.river` is null or exactly matches request river
   - `scope.river_type` contains request river_type or `unknown`
   - `scope.season` contains request season or `unknown`
   - `scope.region` is currently ignored (future use)

2. **Fixed priority by kind**
   - `safety_note` → `river_type_guidance` → `general_guidance` → `angler_reports`

3. **Strict limits**
   - Max 4 snippets total
   - Max 1 `angler_reports` snippet

4. **Selection**
   - Take 1 `safety_note` if available
   - Take 1 `river_type_guidance` if available
   - Fill remaining slots with `general_guidance`
   - Only if space remains, take 1 `angler_reports`
   - Within each kind: highest confidence first, then stable id order

Only summary-level fields are passed to the LLM (`id`, `summary`, `confidence`, `tags`). `sources` and `scope` are never passed.

### River type derivation (MVP)
- Chalkstreams are only assigned via a hard lookup table (`data/river_types.json`).
- If not in the list:
  - Southern regions → `mixed` (conservative).
  - Otherwise → `freestone` (default).
- If river is unknown → `unknown`.
- Region is derived from lat/lon using a conservative bounding heuristic (south/south_east only).

### River matching (snippets)
- Prefer `scope.river_id` over free-text names.
- On load, snippets are validated against the river dataset:
  - If `river_id` is provided and missing → error (fail fast).
  - If `river` is provided, it is normalized and matched:
    - 0 matches → error
    - >1 matches → error (ambiguous)
- Normalization removes “River”, punctuation, and collapses whitespace (e.g. `River Avon (Hampshire)` → `avon hampshire`).

---

## Evolution path

### MVP
- Start with small curated snippet sets by region (e.g. `uk_south.json`)
- Keep confidence mostly low
- Focus on safety, not coverage

### Post-MVP
- Add feedback aggregation outputs (weak priors)
- Increase snippet coverage where feedback volume is strong
- Consider embeddings only when:
  - snippet volume is large
  - search needs are clear
  - safety & selection logic is robust

---

## Definition of success

- Grounding improves relevance without increasing hallucinations.
- Outputs remain conservative and “fishable”.
- Snippets remain reviewable and easy to curate.
