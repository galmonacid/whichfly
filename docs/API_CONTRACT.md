# API Contract — whichFly (MVP)

This document describes request/response structures for whichFly MVP.

## Endpoint (MVP)
- `POST /api/recommendation`
- `GET /api/rivers` (river name list for manual entry)
- `POST /api/river-suggestion` (GPS-only suggestion)

## Request
- `gps` (optional): `{ lat, lon, accuracy? }`
- `waterLevel`: `low | normal | high`
- `riverName` (optional): string (user-selected river)
- `riverReachId` (optional): string (specific section selection)
- `mode` (optional): `right_now | planning` (defaults to `right_now`)
- `plannedDate` (required for planning): `YYYY-MM-DD`
- `observations` (optional):
  - `fishRising`: boolean | null

Derived inputs:
- `season`: derived from `plannedDate` (planning) or system date (right_now)

## River list (`GET /api/rivers`)
Response:
- `options`: array of options
  - `label`: string (e.g., `River Windrush — Upper section`)
  - `reach_id`: string
  - `river_name`: string
  - `section_label`: string | null

## River suggestion (`POST /api/river-suggestion`)
Request:
- `gps` (required): `{ lat, lon, accuracy? }`

Response:
- `river`: `{ name, confidence, distance_m, source }`

## Feedback (`POST /api/feedback`)
Request:
- `recommendationId`: string
- `riverName`: string
- `riverReachId` (optional): string
- `pattern` (optional): string
- `flyType` (optional): `dry | nymph | streamer | wet | emerger`
- `sessionId`: string (anonymous, stored in local storage)
- `outcome`: `up | down`
- `context` (optional):
  - `mode`: `right_now | planning`
  - `waterLevel`: string
  - `plannedDate`: `YYYY-MM-DD`
  - `confidence`: `high | medium | low`

Response:
- `{ ok: true }`

## Response
The response MUST validate against:
- `contracts/right_now.schema.json`

Key fields:
- `river`: suggestion and confidence (see schema)
- `primary`: main fly choice (pattern/type/size)
- `alternatives`: max 2 conditional alternatives
- `explanation`: concise, practical
- `confidence` + `confidence_reasons`
- `meta`: version and mode

---

## Planned additions (not yet implemented)
- `riverId`: stable dataset id (avoids ambiguous names)
- `reachId` / `reachLabel`: coarse reach identifier for long rivers
