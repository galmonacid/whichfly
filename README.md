# whichFly 🪰🎣

**whichFly** helps fly fishers answer one simple question:

> *Which fly should I tie right now, here?*

Built for trout fishing on UK rivers, whichFly is designed to be used **at the river**, when the decision actually matters.

---

## What whichFly does (MVP)

- Recommends the best fly for **current conditions**
- Uses device location to suggest the current river
- Explains *why* the recommendation makes sense
- Suggests simple alternatives if conditions change
- Works fast on mobile, streamside

---

## What whichFly does NOT do (yet)

- No long-term planning by default
- No social features
- No spot discovery
- No brand or shop bias
- No user accounts (MVP)

---

## Design intent

whichFly prioritises **speed, clarity and confidence**.

If it cannot be used quickly at the river, it does not belong in the MVP.

---

## Local development

### Requirements
- Node.js 18+

### Run the app
- `npm run dev`
- Open `http://localhost:3000`

### Run tests
- `npm test`

### Environment variables
- `PORT`: HTTP port for the dev server (default `3000`)
- `WEATHER_API_BASE_URL`: Placeholder for weather API base URL
- `DAYLIGHT_API_BASE_URL`: Placeholder for daylight API base URL
- `OPENAI_API_KEY`: OpenAI API key (required for LLM-first recommendations)
- `OPENAI_MODEL`: OpenAI model name (default `gpt-4o-mini`)

### Local env file (optional)
Create a `.env.local` in the project root to set environment variables for local dev.
