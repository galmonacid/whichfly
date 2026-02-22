# iOS TestFlight Signing and Release Metadata

This document defines the signing and release metadata configuration for the Flutter iOS app before TestFlight upload.

## Final metadata set in repo
- App bundle identifier (Runner): `com.whichfly.app`
- App bundle identifier (RunnerTests): `com.whichfly.app.RunnerTests`
- Display name: `whichFly`
- Flutter app version/build: `1.0.0+2`
- App icon asset set: `app/ios/Runner/Assets.xcassets/AppIcon.appiconset`

## Xcode signing settings (manual)
Open `app/ios/Runner.xcworkspace` and configure:
- `Runner` target:
  - Signing & Capabilities -> Team: your Apple Developer team
  - Signing Certificate: Apple Distribution (release) / Apple Development (debug)
  - Provisioning: Automatic (recommended for MVP) or explicit profile if your org requires manual signing
- `RunnerTests` target:
  - Team selected and signing resolves without errors

Expected result:
- No signing warnings in `Runner` and `RunnerTests`
- A valid provisioning profile is resolved for `com.whichfly.app`

## App Store Connect settings (manual)
Create or verify app record:
- Platform: iOS
- Bundle ID: `com.whichfly.app` (must match Xcode)
- App name: `whichFly`
- SKU: internal unique id (team-defined)

Before upload:
- Add app privacy details and required metadata in App Store Connect
- Confirm TestFlight internal testers are configured

## API base URL for release builds
Set production API endpoint via Dart define when building:

```bash
flutter build ios --release --dart-define=API_BASE_URL=https://<api-domain>
```

Use the same value for CI build/IPA generation to avoid environment drift.

## Icon and launch asset checks
- App icon set files are present in `AppIcon.appiconset` including 1024x1024 marketing icon.
- Confirm icon has no alpha channel and meets App Store guidelines.
- Launch screen assets are in `app/ios/Runner/Assets.xcassets/LaunchImage.imageset`.

## Out of scope for this phase
- Upload to TestFlight
- TestFlight group assignment and distribution
- App Store review submission

## GitHub Actions pipeline
Workflow file:
- `.github/workflows/ios-testflight.yml`

Trigger:
- `workflow_dispatch` with inputs:
  - `api_base_url` (required)
  - `build_name` (optional)
  - `build_number` (optional)
  - `upload_to_testflight` (optional boolean)

Required GitHub secrets:
- `IOS_CERTIFICATE_P12_BASE64`
- `IOS_CERTIFICATE_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64`
- `APPSTORE_CONNECT_ISSUER_ID`
- `APPSTORE_CONNECT_KEY_ID`
- `APPSTORE_CONNECT_PRIVATE_KEY`
