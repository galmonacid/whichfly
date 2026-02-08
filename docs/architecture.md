# High-Level Architecture – whichFly

## App type

- Web application
- Mobile-first, responsive
- Optimised for outdoor use

---

## Core components

### Frontend
- Minimal input UI
- Clear recommendation output
- Designed for quick interaction

### Backend / API
- Receives user inputs
- Enriches context (weather, daylight)
- Orchestrates AI agent execution

### River dataset & preprocessing
- Offline build step ingests GB + NI river data
- Produces reach-level points for context and suggestion

### AI Agent
- Applies fishing heuristics
- Reasons over current conditions
- Produces structured recommendation output

---

## Data flow

Device location  
→ Nearest reach lookup  
→ River suggestion  
→ Context enrichment (weather, daylight from reach coords)  
→ AI agent reasoning  
→ Structured response  
→ UI rendering

---

## Assumptions

- Stateless backend (MVP)
- Cloud-hosted
- External APIs called on demand
