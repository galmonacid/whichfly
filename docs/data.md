# Data Sources & Strategy – whichFly

## Location & river inference

- Device GPS used to suggest nearest river
- River selection always confirmed by user
- Exact tramo detection is out of scope (MVP)

---

## River dataset (MVP)

- Base geometry (GB): OS Open Rivers (open dataset, updated about every six months)
- NI coverage: Rivers Digital Datasets (River Water Bodies + River Segments)
- Preprocess into a static dataset (planned: `data/uk_river_reaches.json`) with:
  - `river_id`, `river_name`
  - `reach_id`, `reach_label` (coarse: upper/middle/lower or length bucket)
  - representative `lat`, `lon` for weather/daylight
- Weather/daylight uses reach coordinates; UI stays river-first unless disambiguation is needed
- Build script: `scripts/build_river_dataset_gpkg.py` reads GeoPackage sources in `data/sources/`
- Optional: `scripts/build_river_dataset.js` can be used if GeoJSONs are already prepared
- Filtering (MVP): keep inland rivers, exclude fictitious segments, remove very short or ditch-like names
- Threshold: `MIN_SUGGESTABLE_LENGTH_M` (default 3000m)
- TODO: Add NI dataset and rebuild `data/uk_river_reaches.json` for full UK coverage
- Legacy fallback: `data/uk_rivers_min.json` is used if `data/uk_river_reaches.json` is missing
- River type lookup: `data/river_types.json` (chalkstream whitelist)
  - Used to derive `river_type` for snippet selection
  - Only rivers in the list are treated as chalkstream
  - Non-listed rivers default to `freestone` (or `mixed` in southern regions when available)

### Alternatives (not selected)
- OpenRiversNetwork (GB) provides a connected network and 100m points, but uses ODbL

### Licensing & attribution (required)
- OS Open Rivers: Attribution required (GB)
- Rivers Digital Datasets (NI): Attribution required
- TODO: Confirm exact attribution text from source providers and add to README before release

---

## External data

### Weather
- Source: Open-Meteo
- Used in real time
 - Planning mode uses forecast data for the selected date when coordinates are available

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
