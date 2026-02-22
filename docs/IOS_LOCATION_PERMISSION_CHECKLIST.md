# iOS Location Permission Flow Checklist (Flutter)

This checklist verifies iOS permission UX behavior for `GeolocatorLocationService` and the Right now flow.

## Scope
- Permission UX only.
- No recommendation logic changes.

## Required app config
- `NSLocationWhenInUseUsageDescription` exists in `app/ios/Runner/Info.plist`.
- Message explains why location is needed for river suggestion.

## UX acceptance checks
- First launch with location enabled:
  - App requests location permission.
  - If granted, app attempts river suggestion.
- Permission denied (not forever):
  - App shows: `Location denied. Select a river manually.`
  - Manual river selector is visible.
- Permission denied forever:
  - App shows: `Location denied permanently. Select a river manually.`
  - Manual river selector is visible.
- Location services disabled:
  - App shows: `Location unavailable. Select a river manually.`
  - Manual river selector is visible.
- Location lookup failure/timeouts:
  - App shows: `Unable to get location. Select a river manually.`
  - Manual river selector is visible.

## Automated coverage mapping
- Widget test for denied:
  - `app/test/widget_test.dart` -> `shows manual selector when location is denied`
- Widget test for denied forever:
  - `app/test/widget_test.dart` -> `shows manual selector when location is denied forever`

## Manual QA notes (pre-TestFlight)
- Validate iOS prompt text on device/simulator.
- Validate deny/deny forever behavior after resetting app permissions in iOS Settings.
