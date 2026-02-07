# Data Sources & Strategy – whichFly

## Location & river inference

- Device GPS used to suggest nearest river
- River selection always confirmed by user
- Exact tramo detection is out of scope (MVP)

---

## External data

### Weather
- Source: Open-Meteo
- Used in real time

### Daylight
- Sunrise / sunset APIs
- Used to contextualise activity

---

## Water level

- Manual input (Low / Normal / High)
- Automation deferred to post-MVP

---

## Knowledge base (internal)

- Generic fly patterns
- Seasonal heuristics
- River-type rules
- Trout behaviour assumptions

---

## Data philosophy

- Contextual accuracy beats technical precision
- User confirmation beats silent assumptions
