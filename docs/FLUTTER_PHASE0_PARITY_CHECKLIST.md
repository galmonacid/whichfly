# Flutter Phase 0 Parity Checklist

## Contract parity decisions
- Keep existing backend endpoints unchanged:
  - `POST /api/recommendation`
  - `GET /api/rivers`
  - `POST /api/river-suggestion`
  - `POST /api/feedback`
- Keep request/response schema unchanged (`contracts/right_now.schema.json`).
- Keep mode behavior unchanged (`right_now` default, `planning` secondary).

## UI parity checklist (to be implemented in Phases 10.2/10.3)
- Right now inputs:
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
- `contracts/fixtures/right_now_response.golden.json`

## Notes
- Tracking is centralized in `docs/plan.md` (Phase 11).
- Fixture assertions are implemented in Flutter tests (Phase `11.3`).
- iOS permission flow checklist and denied/deniedForever coverage are implemented (Phase `11.4`).
- Checklist source: `docs/IOS_LOCATION_PERMISSION_CHECKLIST.md`.
