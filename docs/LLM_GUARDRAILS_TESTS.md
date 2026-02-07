# LLM Guardrails & Tests — whichFly

This document defines the guardrails and the test suite required for LLM-first development.
The goal: preserve user trust by preventing invalid, unsafe, or hallucinated recommendations.

---

## Guardrails (must be enforced in backend)

### 1) Strict JSON-only output
- Reject any output that contains non-JSON text.
- Parse JSON once; if it fails, retry once with a “format correction” message.
- If it fails again, fallback.

### 2) Schema validation
- Validate output against `contracts/right_now.schema.json`.
- If invalid → retry once → fallback.

### 3) Pattern allowlist enforcement
- `primary.pattern` and all `alternatives[].pattern` must be in allowlist.
- If any pattern not allowed:
  - retry once with explicit error “pattern not allowed”
  - fallback if still invalid

### 4) Anti-hallucination rules (content filters)
Reject (or force retry) if explanation contains:
- Specific hatch assertions without evidence (examples):
  - “BWO hatch is on”
  - “mayfly hatch happening”
  - “you’ll see olives today”
- Overly specific local claims:
  - “on the lower beat”
  - “near <named bridge>”
  - “this stretch is known for…”

Acceptable phrasing:
- “In cooler water, subsurface nymphs are a safe start.”
- “If you see fish rising, switch to a dry from the list.”

### 5) Explanation length & tone
- 20–360 chars
- No sales language
- No brand names

### 6) Confidence gating + fallback
- If model returns `confidence=low`, still return response but ensure picks are conservative.
- Fallback triggers (hard):
  - LLM unreachable / timeout
  - invalid JSON after retry
  - schema invalid after retry
  - allowlist violations after retry
  - forbidden content after retry

---

## Test suite (minimum required)

### A) Contract tests
1. **Valid response passes schema**
2. **Invalid size fails schema** (e.g. size=40)
3. **Too many alternatives fails schema**
4. **Missing required fields fails schema**

### B) Allowlist tests
1. **Primary pattern not allowed → retry then fallback**
2. **Alternative pattern not allowed → retry then fallback**

### C) Hallucination filter tests
1. Explanation includes “hatch is on” → rejected
2. Explanation includes named location claim “near X bridge” → rejected
3. Explanation uses generic seasonal reasoning → allowed

### D) Retry behavior tests
1. First LLM response non-JSON → triggers one retry
2. Second response valid JSON → accepted
3. Second response still invalid → fallback

### E) Timeout / resilience tests
1. LLM call times out → fallback
2. External context APIs fail → still returns recommendation (with lower confidence reason)

### F) Deterministic fallback tests (even in LLM-first)
Define a minimal safe fallback:
- primary: Pheasant Tail Nymph #16 (type nymph)
- alternatives: Elk Hair Caddis #14 if fish rising (type dry)
- explanation: short, generic, non-hallucinated

Test:
- fallback response always passes schema
- fallback uses only allowlist patterns

---

## Suggested “format correction” retry message
When retrying, send:

- “Your output was invalid. Return JSON ONLY matching the schema.”
- Include the schema-required keys list.
- Remind: “Use ONLY allowlist patterns.”

---

## Implementation note
These tests should run in CI and gate merges.
No guardrails = no LLM-first.
