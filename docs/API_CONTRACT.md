# API Contract — whichFly (MVP)

This document describes request/response structures for whichFly MVP.

## Endpoint (MVP)
- `POST /api/recommendation`

## Request
- `gps` (optional): `{ lat, lon, accuracy? }`
- `waterLevel`: `low | normal | high`
- `riverName` (optional): string (user-selected river)
- `observations` (optional):
  - `fishRising`: boolean | null

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
