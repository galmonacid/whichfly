# MVP Definition – whichFly

## MVP scope (included)

- Flutter app with shared codebase for iOS + web
- UK rivers only
- Trout species only
- Primary mode: By the riverside (streamside)
- UK-wide river dataset with reach-level representative points for context (GB now, NI pending)

---

## Inputs

### By the riverside (default)
- Device location (GPS, optional)
- Water level (manual: Low / Normal / High)
- Optional observation: fish rising (Yes / No / Not sure)

### Planning mode (secondary)
- Date
- River (manual selection)

---

## Context (automatic)

- Current weather
- Current daylight
- Season inferred from date
- River reach context (coarse, derived from dataset)

---

## Output

- One primary fly recommendation (for now, here)
- Up to two contextual alternatives
- Short, practical explanation

---

## Explicitly out of scope

- Exact river tramo / beat detection
- Multi-day forecasts
- User accounts
- Payments
- Social features

---

## Definition of done

The MVP is done when:
- A user at the river can get a recommendation in under 30 seconds
- The river suggestion can be confirmed or corrected
- The output feels credible and actionable
