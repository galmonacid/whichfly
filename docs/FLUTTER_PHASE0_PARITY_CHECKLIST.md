# Flutter Phase 0 Parity Checklist

## Contract parity decisions
- Keep existing backend endpoints unchanged:
  - `POST /api/recommendation`
  - `GET /api/rivers`
  - `POST /api/river-suggestion`
  - `POST /api/feedback`
- Keep request/response schema unchanged (`contracts/by_the_riverside.schema.json`).
- Keep mode behavior unchanged (`by_the_riverside` default, `planning` secondary).

## UI parity checklist (to be implemented in Phases 10.2/10.3)
- By the riverside inputs:
  - River suggestion + confirm/change
  - Water level
  - Optional fish rising observation
- Planning inputs:
  - Date
  - River selection
- Recommendation output:
  - River
  - Primary fly
  - Alternatives
  - Explanation
  - Confidence + disclaimer behavior
- Context panel:
  - Weather
  - Daylight
  - Input context summary

## Golden fixtures
- `contracts/fixtures/by_the_riverside_response.golden.json`

## Notes
- Tracking is centralized in `docs/plan.md` (Phase 11).
- Fixture assertions are implemented in Flutter tests (Phase `11.3`).
- iOS permission flow checklist and denied/deniedForever coverage are implemented (Phase `11.4`).
- Checklist source: `docs/IOS_LOCATION_PERMISSION_CHECKLIST.md`.
