# PHASED_PLAN.md — whichFly (UK Rivers · Trout)

This plan breaks the project into phases with small, sequential tasks.
Each task is intended to be executed one-at-a-time with Codex, producing a small diff and a Change Summary per `AGENTIC_DEVELOPMENT.md`.

---

## How to use this plan with Codex

For each task:
1. Paste the **Session Canonical Prompt** (once per session).
2. Paste the **Task prompt** for the next item below.
3. Ensure Codex returns:
- small diff
- tests run + results
- risk/rollback notes

---

## [] Phase 0 — Repo & Foundations (MVP discipline)

### [DONE] 0.1 Add/verify docs baseline
**Goal:** Ensure repo has all product/protocol docs.
- Files must exist: `README.md`, `PRODUCT.md`, `MVP.md`, `ARCHITECTURE.md`, `AI_AGENT.md`, `AGENTIC_DEVELOPMENT.md`, `DATA.md`, `ROADMAP.md`, `PHASED_PLAN.md`

**Task prompt**
```text
Read AGENTIC_DEVELOPMENT.md. Verify the docs baseline exists and is consistent.
If any doc is missing, add it using the latest agreed content. Do not change scope.
Add EXECUTION_PLAN.md if missing.
Provide Change Summary with tests (if any) and rollback notes.
```

### [DONE] 0.2 Add standard repo hygiene
**Goal:** Keep repo clean and safe.
- Add .gitignore
- Add .editorconfig
- Add LICENSE (choose MIT unless instructed otherwise)
- Add SECURITY.md (minimal)
- Add CODE_OF_CONDUCT.md (optional)

**Task prompt**
```text
Add repo hygiene files: .gitignore, .editorconfig, LICENSE (MIT), and a minimal SECURITY.md.
Keep changes minimal and aligned with AGENTIC_DEVELOPMENT.md.
Provide Change Summary and any checks/tests run.
```

---

## [] Phase 1 — Skeleton App (UI + API with mocks)

### [DONE] 1.1 Choose minimal stack and create skeleton
**Goal:** Bootable app with one page + one API endpoint returning mocked JSON.
- Frontend: mobile-first single screen
- Backend: /api/recommendation returns hardcoded response
- No DB, no auth

**Task prompt**
```text
Read PRODUCT.md, MVP.md, ARCHITECTURE.md, and AGENTIC_DEVELOPMENT.md.
Create a minimal project skeleton: frontend + backend API (/api/recommendation) returning mocked JSON.
No auth, no DB. Add simple run instructions to README.
Add minimal tests (at least one backend test).
Provide file tree, key file contents, and commands to run locally.
Include Change Summary with tests run and results.
```

### [DONE] 1.2 Define request/response contract (types + validation)
**Goal:** A stable API contract the UI can depend on.

**Request:**
- lat/lon optional
- accuracy optional
- waterLevel (Low/Normal/High)
- riverOverride optional (when user changes)
- mode: right_now or planning (planning can be unused for now)

**Response:**
- river: { name, confidence, distance_m?, source }
- primary: { pattern, type, size }
- alternatives: [{ when, pattern, type, size }] (max 2)
- explanation: string

**Task prompt**
```text
Implement a typed API contract and input validation for /api/recommendation.
Define TypeScript types (or JSON schema if preferred) for request/response.
Update mocked response to conform. Add tests for validation errors.
Keep changes minimal. Provide Change Summary with tests.
```

### [DONE] 1.3 Build the minimal “Right now” UI (no GPS yet)
**Goal:** User can pick water level and request a recommendation.
- Water level selector
- Button “What should I tie now?”
- Render response (river + primary + alternatives + explanation)

**Task prompt**
```text
Implement the minimal Right now UI:
- water level selector (Low/Normal/High)
- call /api/recommendation
- render response fields clearly on mobile
No geolocation yet.
Add at least one basic frontend smoke test if feasible.
Provide Change Summary with tests.
```

---

## [DONE] Phase 2 — GPS & River Suggestion UX (without real river inference)

### [DONE] 2.1 Add geolocation capture on the client
**Goal:** Get lat/lon + accuracy and send to backend.
- Request permission
- Handle denied/unavailable gracefully
- Keep UI minimal

**Task prompt**
```text
Add device geolocation capture (lat/lon/accuracy) to the Right now UI.
Send these fields to /api/recommendation when available.
If denied/unavailable, proceed without location and show manual river selection placeholder.
Keep changes minimal. Provide Change Summary with tests.
```

### [DONE] 2.2 Add “Suggested river” confirmation UX
**Goal:** “Suggested river: X” with Confirm/Change even if backend is still mock.
- UI always allows correction
- If user taps Change → show manual selector and send riverOverride

**Task prompt**
```text
Implement river confirmation UX:
- Show suggested river from API
- Buttons: Confirm / Change
- If Change, show manual river selector and send riverOverride to backend
Backend can still return mocked suggestion but must accept riverOverride.
Add minimal tests. Provide Change Summary with tests.
```

---

## [DONE] Phase 3 — Context Enrichment (Weather + Daylight)

### [DONE] 3.1 Integrate Open-Meteo (backend)
**Goal:** Enrich internal agent input with current weather using lat/lon.
- Timeouts
- Error handling
- No breaking UI

**Task prompt**
```text
Integrate Open-Meteo in the backend:
- If lat/lon provided, fetch current weather (temp, precipitation, cloud cover)
- Add timeouts and graceful fallback if API fails
- Log debug info in dev only (no PII)
Do not change response structure yet (still mocked recommendation).
Add tests using mocked HTTP.
Provide Change Summary with tests and rollback notes.
```

### [DONE] 3.2 Integrate daylight (sunrise/sunset) (backend)
**Goal:** Add daylight context (sunrise, sunset, daylight remaining).
- Use a simple sunrise/sunset API
- Same reliability standards as weather

**Task prompt**
```text
Integrate sunrise/sunset context in the backend when lat/lon is available.
Compute useful derived fields (e.g., isDaylight, minutesToSunset).
Keep API response unchanged (still mocked recommendation).
Add tests with mocked HTTP.
Provide Change Summary with tests and rollback notes.
```

---

## [] Phase 4 — River Inference (MVP-quality, simple)

### [DONE] 4.1 Start with a curated river list (fast path)
**Goal:** Ship something usable before full GIS.
- Add data/uk_rivers_min.json with ~50 trout rivers + representative coords
- Backend selects nearest by haversine distance
- Use distance threshold and confidence scoring

**Task prompt**
```text
Implement simple river suggestion using a curated dataset:
- Add data/uk_rivers_min.json with ~50 UK trout rivers and representative lat/lon
- Given user lat/lon, choose nearest within a threshold; otherwise return Unknown
- Return distance_m and confidence (high/medium/low)
Add unit tests for selection and threshold behavior.
Provide Change Summary with tests and rollback notes.
```

### [DONE] 4.2 Improve disambiguation using GPS accuracy
**Goal:** Use accuracy to adjust thresholds.
- If accuracy is poor, lower confidence or widen threshold but require confirmation

**Task prompt**
```text
Improve river suggestion by using GPS accuracy:
- Adjust confidence based on accuracy and distance
- If accuracy is poor, prefer returning Unknown over a wrong high-confidence match
Add tests for accuracy-driven logic.
Provide Change Summary with tests.
```

### [DONE] 4.3 Expand river dataset pipeline (GB, with NI-ready inputs)
**Goal:** Replace curated list with a scalable dataset pipeline.
- Source GB rivers from OS Open Rivers (GeoPackage)
- Add preprocessing script (OSGB → WGS84) to build a static dataset
- Normalize English/Welsh naming (prefer English where available)
- Filter out non-river forms and very short/ditch-like names (MVP)
- Add attribution and license notes
- Update tests for river lookup using the new dataset

**Task prompt**
```text
Expand the river dataset to full UK coverage (GB + NI).
- Ingest OS Open Rivers (GB) and NI Rivers Digital Datasets
- Add a preprocessing script to generate a static dataset (ids, names, representative coords)
- Add attribution/license notes
- Update river lookup to use the new dataset
Add unit tests for lookup and NI coverage.
Provide Change Summary with tests and rollback notes.
```

### [DONE] 4.4 Add coarse reach segmentation for long rivers
**Goal:** Improve weather/daylight accuracy without precise tramo detection.
- Split long rivers into coarse reaches (e.g., upper/middle/lower or length buckets)
- Add reach ids + representative coords
- Use reach coords for weather/daylight enrichment
- Expose reach sections in river selector (Upper/Middle/Lower)

**Task prompt**
```text
Add coarse reach segmentation for long rivers.
- Derive reach ids + representative coords for long rivers
- Use reach coords for weather/daylight enrichment
- Expose reach sections in the selector for manual choice
Add tests for reach assignment and weather/daylight inputs.
Provide Change Summary with tests and rollback notes.
```

### [] 4.5 Add NI coverage to the dataset
**Goal:** Complete UK coverage by adding NI river data.
- Provide NI Rivers Digital Datasets (GeoPackage or GeoJSON)
- Run the build script to regenerate `data/uk_river_reaches.json`
- Validate NI rivers appear in the selector

**Task prompt**
```text
Add NI coverage by ingesting NI Rivers Digital Datasets.
- Provide NI source files in data/sources
- Regenerate data/uk_river_reaches.json
- Verify NI rivers appear in /api/rivers options
Add a small test to verify NI lookup.
Provide Change Summary with tests and rollback notes.
```

---

## [] Phase 5 — LLM Contract & Guardrails

### [DONE] 5.1 Add LLM response contract (schema)
**Goal:** Make LLM output machine-safe.
- Add contracts/right_now.schema.json
- Enforce strict JSON validation
- Backend rejects invalid output

### [DONE] 5.2 Add fly pattern allowlist
**Goal:** Prevent hallucinated or obscure recommendations.
- Add docs/FLY_ALLOWLIST.md
- Backend enforces allowlist when `ALLOWLIST_ENFORCEMENT=true` (default off)
- Tests for allowlist violations

### [DONE] 5.3 Implement LLM guardrails & retry logic
**Goal:** Make LLM failure non-fatal.
- JSON-only output
- One retry with correction message
- Hard fallback on second failure
- Forbidden phrases filter (“hatch is on”, local claims)

### [DONE] 5.4 Implement conservative fallback recommender
**Goal:** Always return something fishable.
- Single safe recommendation
- Uses allowlist
- No LLM

### [PARTIAL] 5.5 Grounding snippets store (curated, versioned)
**Goal:** Add a controlled knowledge layer for grounding without scraping/quoting.
- Add `knowledge/` folder with:
  - `knowledge/heuristics/*.yaml` (stable guidance)
  - `knowledge/snippets/*.json` (curated summaries with metadata + confidence)
- Add loader code that selects relevant snippets by region/season and passes them to the LLM as background:
  - must be framed as non-factual background ("do not assert as facts")
  - must never introduce hatch claims
- Add tests for snippet selection and prompt injection safety.

**Status**
- Implemented: snippets store, loader, deterministic selection (river/season/river_type), load-time validation, tests for selection/limits.
- Pending: `knowledge/heuristics/` starter content, region-based selection, prompt injection safety tests.

**Task prompt**
```text
Add a curated grounding snippets store and loader:
- Create the `knowledge/` structure (heuristics + snippets) with a few starter entries
- Implement snippet selection (by region/season/river)
- Pass selected snippets to the LLM as background with strict instructions
- Add tests ensuring snippets cannot override schema/allowlist/guardrails
Provide Change Summary with tests and rollback notes.
```

---

## [DONE] Phase 6 — LLM-first Recommendation Engine

### [DONE] 6.1 Implement LLM-first recommendation engine
**Goal:** LLM produces the recommendation, within guardrails.
- LLM enabled by default
- Uses canonical prompt
- Must comply with schema + allowlist (allowlist enforced when flag on)
- Confidence returned by model
- Backend enforces confidence gating

### [DONE] 6.2 Add LLM confidence gating UX
**Goal:** Be honest when certainty is low.
- If confidence = low:
- Show disclaimer
- Or ask 1 optional observation (“fish rising?”)

---

## [DONE] Phase 7 — Planning Mode (Secondary)

### [DONE] 7.1 Add planning UI (secondary entry)
**Goal:** Keep “Right now” primary; planning is tucked away.
- Link/button: “Planning a trip?”
- Inputs: date + river (manual)
- Uses same recommender with “planning” context

**Task prompt**
```text
Add a secondary Planning mode:
- entry link “Planning a trip?”
- inputs: date + river (manual)
- call backend with mode=planning and provided date/river
Ensure Right now remains the default and primary UI.
Add minimal tests. Provide Change Summary with tests and rollback notes.
```

---

## [DONE] Phase 8 — Feedback Loop (Lightweight)

### [DONE] 8.1 Add “Did it work?” feedback capture (no accounts)
**Goal:** Collect signal without building a user system.
- Buttons 👍 / 👎
- Send event to backend log/store (initially server log or lightweight file)
- No PII, no user tracking beyond anonymous session id

**Task prompt**
```text
Implement a lightweight feedback loop:
- UI buttons: Did it work? 👍 👎
- Send to backend /api/feedback with recommendation id + river + basic context
- No user accounts; minimal anonymous session id in local storage is ok
Add tests for endpoint validation.
Provide Change Summary with tests and rollback notes.
```

### [] 8.2 Feedback aggregation & learning (no accounts)
**Goal:** Use feedback as a weak signal to improve reliability without claiming "truth".
- Add a lightweight aggregation job/script (daily/weekly) that produces summaries:
  - success rate by confidence (high/medium/low)
  - success rate by season
  - success rate by method (dry/nymph/streamer)
  - top patterns by season/region (as weak priors)
- Store summaries as versioned artifacts (e.g. `data/feedback_summaries/*.json`)
- Update backend to optionally use summaries to:
  - adjust confidence gating thresholds
  - bias pattern selection (within allowlist)
  - choose which contextual snippets to pass to the LLM
- Never surface raw stats to end users; never claim "other anglers did X".

**Task prompt**
```text
Implement feedback aggregation and safe usage:
- Create a script/job to aggregate /api/feedback events into summary JSON files
- Add tests for aggregation logic
- Update the recommender pipeline to optionally consume summaries as weak priors:
  - only within allowlist
  - no hatch/local factual claims
  - do not change schema
Provide Change Summary with tests and rollback notes.

---

## [] Phase 9 — Hardening & Release Readiness

### [] 9.1 Observability & error handling
- Structured logs
- Disable verbose logs in prod
- Sane error messages to user

### [] 9.2 Performance / offline basics
- Fast initial load
- Cache last successful recommendation locally
- Graceful “no signal” mode

### [] 9.3 Deployment
- Minimal CI (lint + tests)
- One-click deploy target

(These are intentionally later; only start once core UX is proven.)

---

## [] Done criteria (project-level)
- Right now flow works in < 30 seconds on mobile
- River suggestion is confirmable and correction is easy
- Recommendations are credible and not overconfident
- No scope creep: no accounts, payments, or social features in MVP
