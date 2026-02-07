# API Contract — whichFly (MVP)

This document describes request/response structures for whichFly MVP.

## Endpoint (MVP)
- `POST /api/right-now`

## Request (suggested)
- `lat` (optional)
- `lon` (optional)
- `accuracy_m` (optional)
- `water_level`: Low | Normal | High
- `river_override` (optional): string
- `mode`: right_now | planning (planning may be unused initially)

## Response
The response MUST validate against:
- `contracts/right_now.schema.json`

Key fields:
- `river`: suggestion and confidence
- `primary`: main fly choice (pattern/type/size)
- `alternatives`: max 2 conditional alternatives
- `explanation`: concise, practical
- `confidence` + `confidence_reasons`
