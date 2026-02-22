# Refactor Plan — whichFly to Flutter (Web + iOS)

## Goal
Move the current web UI to a **single Flutter codebase** that can ship as:
- **iOS app** (primary)
- **Web build** (secondary, hosted on Firebase Hosting)

Backend remains **Node + Cloud Run** with the existing API contract.

This is a **UI refactor**, not a product expansion. The MVP scope stays the same.

---

## Current state (snapshot)
- Frontend: static HTML/CSS/JS in `frontend/`
- Backend: Node API in `backend/` (Cloud Run target)
- Hosting: Firebase Hosting + Cloud Run rewrites
- Tests:
  - Backend unit/integration tests (API, guardrails, knowledge, weather/daylight)
  - Frontend **only smoke test** (`frontend/__tests__/smoke.test.js`)

---

## Are tests sufficient for a refactor?
**No.** We have strong backend coverage, but **minimal UI coverage**.
Risks:
- UI regressions in Right now/Planning flows
- Permission/geo flow differences on iOS
- Subtle UX changes (toggle states, validation messages)

**Minimum additional test coverage recommended before refactor:**
- API contract fixture test (snapshot response from backend)
- UI flow tests (Right now + Planning) using:
  - Flutter widget tests
  - 1 integration test (happy path) for iOS + web

---

## Migration approach (safe + incremental)
Keep the backend **unchanged**. Replace the frontend with Flutter.

### Phase 0 — Decision & parity checklist
- Confirm we keep the same API schema and routes.
- Define UI parity checklist (fields, flows, toggles, errors).
- Add golden JSON fixtures for API responses.
- Outputs:
  - `docs/FLUTTER_PHASE0_PARITY_CHECKLIST.md`
  - `contracts/fixtures/right_now_response.golden.json`

### Phase 1 — Flutter scaffolding
- Create `app/` Flutter project in repo.
- Add environment config for API base URL.
- Set up Firebase Hosting for Flutter web build (`flutter build web` output).
- Add CI build step for Flutter web and widget tests.

### Phase 2 — Right now flow
- Rebuild UI: water level, river selection, fish rising, submit.
- Geolocation + permission prompts (iOS).
- Context panel and confidence UX parity.

### Phase 3 — Planning flow
- Date + river input
- API call with `mode=planning`
- Render recommendation + context

### Phase 4 — Parity + regression tests
- Widget tests for key UI states.
- Integration test (iOS simulator or web runner).
- Compare outputs against backend fixtures.

---

## Key considerations / risks
- **Geolocation on iOS** requires `Info.plist` permissions.
- **App Store review** can delay releases.
- **Release cadence** is slower than web.
- **WebView/Flutter web** can behave differently than static JS.
- **Backend parity** must stay stable (no API drift).

---

## Acceptance criteria
- Right now and Planning flows match current behaviour.
- API request payloads are identical.
- Output rendering matches existing UI requirements.
- iOS permissions and error states are handled.
- Tests cover at least one full flow and major UI states.

---

## Resume prompt for implementation
```text
You are an agentic development assistant working on the whichFly project.

Before doing anything:
- Read and follow AGENTIC_DEVELOPMENT.md strictly.
- Treat PRODUCT.md, MVP.md, AI_AGENT.md, DATA.md, and ARCHITECTURE.md as sources of truth.
- whichFly is a streamside, “right now” decision-support tool for UK river trout fishing.

Non-negotiable constraints:
- Do NOT add features outside the defined MVP.
- Do NOT add authentication, user accounts, payments, social features, or persistence unless explicitly asked.
- Do NOT optimise prematurely or refactor unrelated code.
- Prefer small, reviewable diffs.

Working rules:
- One task at a time.
- If intent is unclear, stop and ask via TODO comments instead of guessing.
- Make reasoning explicit in comments where helpful.
- Use deterministic logic by default; LLM usage must be gated and validated.

After each change, you MUST include a Change Summary with:
- Scope: what changed and why
- Tests: exact commands run and results
- Risk / Rollback: what could break and how to revert

Task:
Start Phase 0 of the Flutter refactor plan in docs/REFACTOR_TO_FLUTTER.md.
Create the Flutter `app/` scaffold and add minimal config for API base URL.
Do not change backend logic. Keep diffs small.
```
