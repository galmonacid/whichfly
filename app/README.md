# whichfly_app

Flutter client scaffold for whichFly (Phase 0).

## Run locally

- Default API base URL: `/` (same-origin)
- Run:
  - `flutter run`
- Override API base URL:
  - Local backend on port 3000:
    - `flutter run --dart-define=API_BASE_URL=http://localhost:3000`
  - Custom domain:
    - `flutter run --dart-define=API_BASE_URL=https://your-domain.example`

## Notes

- Backend contract remains unchanged (`/api/recommendation`, `/api/rivers`, `/api/river-suggestion`, `/api/feedback`).
- This scaffold is intentionally minimal and will be expanded in Phase 10.2+.
