import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const lookupPath = path.resolve(__dirname, "..", "data", "river_types.json");

function loadRiverTypeLookup() {
  let content = "{}";
  try {
    content = readFileSync(lookupPath, "utf-8");
  } catch (error) {
    return new Map();
  }

  const parsed = JSON.parse(content);
  const entries = Object.entries(parsed || {});
  const map = new Map();
  for (const [name, type] of entries) {
    if (typeof name !== "string" || typeof type !== "string") {
      continue;
    }
    map.set(name, type);
    map.set(name.toLowerCase(), type);
  }
  return map;
}

const RIVER_TYPE_LOOKUP = loadRiverTypeLookup();

function normalizeRegion(region) {
  if (!region || typeof region !== "string") {
    return null;
  }
  const normalized = region.trim().toLowerCase();
  if (normalized === "south east" || normalized === "south-east") {
    return "south_east";
  }
  if (normalized === "southeast") {
    return "south_east";
  }
  if (normalized === "south") {
    return "south";
  }
  return normalized;
}

export function deriveRiverType(riverName, region) {
  if (!riverName) {
    return { type: "unknown", confidence: "low", source: "no_river" };
  }

  const directMatch = RIVER_TYPE_LOOKUP.get(riverName) || RIVER_TYPE_LOOKUP.get(String(riverName).toLowerCase());
  if (directMatch === "chalkstream") {
    return { type: "chalkstream", confidence: "high", source: "lookup" };
  }

  const regionKey = normalizeRegion(region);
  if (regionKey === "south" || regionKey === "south_east") {
    return { type: "mixed", confidence: "low", source: "region_heuristic" };
  }

  return { type: "freestone", confidence: "low", source: "default" };
}

export function deriveRegionFromCoords(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") {
    return null;
  }

  // Conservative heuristic: only classify south/south_east when clearly in range.
  if (lat < 52.2 && lon >= -1.5) {
    return "south_east";
  }

  if (lat < 53.1) {
    return "south";
  }

  return null;
}
