# High-Level Architecture – whichFly

## App type

- Cross-platform Flutter client (iOS + web)
- Mobile-first, responsive
- Optimised for outdoor use

---

## Core components

### Frontend
- Flutter UI (single codebase for iOS + web)
- Minimal input UI
- Clear recommendation output
- Designed for quick interaction
- Web build hosted on Firebase Hosting

### Backend / API
- Receives user inputs
- Enriches context (weather, daylight)
- Orchestrates AI agent execution
- Runs as a Cloud Run service (public API)

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
- Flutter client targets iOS + web
- Firebase Hosting + Cloud Run for web/API
- External APIs called on demand
