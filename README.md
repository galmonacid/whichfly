# whichFly 🪰🎣

**whichFly** helps fly fishers answer one simple question:

> *Which fly should I tie right now, here?*

Built for trout fishing on UK rivers, whichFly is designed to be used **at the river**, when the decision actually matters.

---

## What whichFly does (MVP)

- Recommends the best fly for **current conditions**
- Uses device location to suggest the current river
- Explains *why* the recommendation makes sense
- Suggests simple alternatives if conditions change
- Works fast on mobile, streamside

---

## What whichFly does NOT do (yet)

- No long-term planning by default
- No social features
- No spot discovery
- No brand or shop bias
- No user accounts (MVP)

---

## Design intent

whichFly prioritises **speed, clarity and confidence**.

If it cannot be used quickly at the river, it does not belong in the MVP.

---

## Local development

### Requirements
- Node.js 18+
- Flutter SDK (required for Phase 10 migration work)
- Xcode (required for local iOS builds)

### Run the app
- `npm run dev`
- Open `http://localhost:3000`

### Flutter migration status
- Current frontend runtime is still `frontend/` (HTML/CSS/JS).
- Target architecture is Flutter for iOS + web (`docs/REFACTOR_TO_FLUTTER.md`).
- Flutter app scaffolding and migration tasks are tracked in Phase 10 (`docs/plan.md`).

### Run tests
- `npm test`

### Aggregate feedback summaries
- `npm run aggregate-feedback`

### Environment variables
- `PORT`: HTTP port for the dev server (default `3000`)
- `WEATHER_API_BASE_URL`: Placeholder for weather API base URL
- `DAYLIGHT_API_BASE_URL`: Placeholder for daylight API base URL
- `OPENAI_API_KEY`: OpenAI API key (required for LLM-first recommendations)
- `OPENAI_MODEL`: OpenAI model name (default `gpt-4o-mini`)
- `ALLOWLIST_ENFORCEMENT`: Set to `true` to enforce fly allowlist validation (default `false`)
- `FEEDBACK_STORE_PATH`: Path to append feedback events (JSONL). If unset, feedback is not stored.
- `FEEDBACK_SUMMARY_PATH`: Path to read feedback summaries (default `data/feedback_summaries/latest.json`)
- `FEEDBACK_SUMMARY_DIR`: Output directory for the aggregation script (default `data/feedback_summaries/`)

### Local env file (optional)
Create a `.env.local` in the project root to set environment variables for local dev.

---

## Deployment (Firebase Hosting + Cloud Run)

This repo includes GitHub Actions workflows:
- `CI` runs lint + tests on push/PR.
- `Deploy` deploys Cloud Run (API) and Firebase Hosting (frontend) on push to `main`.
- Deploy now builds Flutter web (`app/build/web`) before publishing Hosting.
- `iOS TestFlight` builds a signed iOS IPA on macOS and can upload it to TestFlight (manual trigger).

Prerequisites:
- Firebase project with billing enabled
- Cloud Run and Cloud Build APIs enabled

Required GitHub secrets:
- `GCP_PROJECT_ID`
- `GCP_SA_KEY` (service account JSON with permissions to deploy Cloud Run and Firebase Hosting)

Additional secrets for iOS TestFlight workflow:
- `IOS_CERTIFICATE_P12_BASE64`
- `IOS_CERTIFICATE_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64`
- `APPSTORE_CONNECT_ISSUER_ID`
- `APPSTORE_CONNECT_KEY_ID`
- `APPSTORE_CONNECT_PRIVATE_KEY`

Cloud Run settings:
- Service name and region are defined in `firebase.json` and `.github/workflows/deploy.yml`.
- TODO: Confirm `whichfly-api` and `europe-west1` before the first deploy.

Runtime env vars:
- Configure `OPENAI_API_KEY`, `OPENAI_MODEL`, and related settings in Cloud Run service env vars.

---

## Data sources & attribution

This project uses public river datasets to build the local river index. Attribution text must be
confirmed against the source license terms before release.

- OS Open Rivers (Great Britain). TODO: Insert the required attribution text from OS.
- Rivers Digital Datasets (Northern Ireland). TODO: Insert the required attribution text from DAERA/NI.
