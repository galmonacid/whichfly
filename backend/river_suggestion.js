import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reachesPath = path.resolve(__dirname, "..", "data", "uk_river_reaches.json");
const legacyRiversPath = path.resolve(__dirname, "..", "data", "uk_rivers_min.json");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeEntry(entry) {
  if (!entry) return null;
  const riverName = entry.river_name || entry.name;
  const riverNameAlt = entry.river_name_alt || null;
  const lat = entry.lat;
  const lon = entry.lon;
  if (!riverName || typeof lat !== "number" || typeof lon !== "number") {
    return null;
  }
  const riverId = entry.river_id || slugify(riverName);
  const reachRank = Number.isFinite(entry.reach_rank) ? entry.reach_rank : 1;
  const reachId = entry.reach_id || `${riverId}-${reachRank}`;
  const reachLabel = entry.reach_label || "single";

  return {
    river_id: riverId,
    river_name: riverName,
    river_name_alt: riverNameAlt,
    reach_id: reachId,
    reach_label: reachLabel,
    reach_rank: reachRank,
    lat,
    lon,
    source: entry.source || "unknown"
  };
}

function normalizeDataset(dataset) {
  if (dataset && dataset.__normalized) {
    return dataset;
  }
  const normalized = (dataset || [])
    .map(normalizeEntry)
    .filter(Boolean);
  Object.defineProperty(normalized, "__normalized", { value: true });
  return normalized;
}

function loadDataset() {
  try {
    const raw = JSON.parse(readFileSync(reachesPath, "utf-8"));
    return normalizeDataset(raw);
  } catch (error) {
    const legacyRaw = JSON.parse(readFileSync(legacyRiversPath, "utf-8"));
    return normalizeDataset(legacyRaw);
  }
}

const rivers = loadDataset();

const EARTH_RADIUS_M = 6371000;
const DEFAULT_MAX_DISTANCE_M = 30000;
let cachedRiverNames = null;
let cachedRiverOptions = null;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

function getDataset(customDataset) {
  if (!customDataset) {
    return rivers;
  }
  return normalizeDataset(customDataset);
}

function sectionLabelForRank(rank, total) {
  if (total === 2) {
    return rank === 1 ? "Upper section" : "Lower section";
  }
  if (total === 3) {
    if (rank === 1) return "Upper section";
    if (rank === 2) return "Middle section";
    return "Lower section";
  }
  if (total > 1) {
    return `Section ${rank} of ${total}`;
  }
  return null;
}

export function listRiverOptions(options = {}) {
  const dataset = getDataset(options.rivers);
  if (!options.rivers && cachedRiverOptions) {
    return cachedRiverOptions;
  }

  const grouped = new Map();
  for (const reach of dataset) {
    const key = reach.river_id || reach.river_name;
    if (!key) continue;
    const entry = grouped.get(key) || {
      river_name: reach.river_name,
      river_name_alt: reach.river_name_alt || null,
      reaches: []
    };
    entry.reaches.push(reach);
    grouped.set(key, entry);
  }

  const optionsList = [];
  for (const entry of grouped.values()) {
    const reaches = entry.reaches.sort((a, b) => (a.reach_rank || 1) - (b.reach_rank || 1));
    const total = reaches.length;
    for (const reach of reaches) {
      const rank = reach.reach_rank || 1;
      const sectionLabel = sectionLabelForRank(rank, total);
      const label = sectionLabel
        ? `${entry.river_name} — ${sectionLabel}`
        : entry.river_name;
      optionsList.push({
        reach_id: reach.reach_id,
        river_name: entry.river_name,
        river_name_alt: entry.river_name_alt,
        section_label: sectionLabel,
        label
      });
    }
  }

  optionsList.sort((a, b) => a.label.localeCompare(b.label));

  if (!options.rivers) {
    cachedRiverOptions = optionsList;
    cachedRiverNames = null;
  }
  return optionsList;
}

export function listRiverNames(options = {}) {
  if (!options.rivers && cachedRiverNames) {
    return cachedRiverNames;
  }
  const optionsList = listRiverOptions(options);
  const names = Array.from(new Set(optionsList.map((entry) => entry.river_name))).sort((a, b) =>
    a.localeCompare(b)
  );
  if (!options.rivers) {
    cachedRiverNames = names;
  }
  return names;
}

function matchesRiverName(reach, target) {
  if (!reach || !target) return false;
  const primary = reach.river_name?.toLowerCase();
  const alt = reach.river_name_alt?.toLowerCase();
  return primary === target || alt === target;
}

function confidenceForDistance(distanceM) {
  if (distanceM <= 5000) return "high";
  if (distanceM <= 15000) return "medium";
  return "low";
}

function degradeConfidence(confidence) {
  if (confidence === "high") return "medium";
  if (confidence === "medium") return "low";
  return "low";
}

export function findNearestReach(lat, lon, options = {}) {
  const dataset = getDataset(options.rivers);
  let best = null;

  for (const reach of dataset) {
    const distanceM = haversineDistance(lat, lon, reach.lat, reach.lon);
    if (!best || distanceM < best.distance_m) {
      best = {
        reach,
        distance_m: distanceM
      };
    }
  }

  return best;
}

function buildSuggestionFromNearest(nearest, { maxDistanceM, accuracyM }) {
  if (!nearest || !nearest.reach || nearest.distance_m > maxDistanceM) {
    return {
      name: "Unknown",
      confidence: "low",
      source: "unknown",
      distance_m: null
    };
  }

  let confidence = confidenceForDistance(nearest.distance_m);

  if (accuracyM !== null) {
    if (accuracyM > 1000 && nearest.distance_m > 15000) {
      return {
        name: "Unknown",
        confidence: "low",
        source: "unknown",
        distance_m: null
      };
    }

    if (accuracyM > 200) {
      confidence = degradeConfidence(confidence);
    }
  }

  return {
    name: nearest.reach.river_name,
    confidence,
    distance_m: Math.round(nearest.distance_m),
    source: "gps_suggested"
  };
}

export function suggestRiver(lat, lon, options = {}) {
  const maxDistanceM = options.maxDistanceM || DEFAULT_MAX_DISTANCE_M;
  const accuracyM = options.accuracyM ?? null;
  const nearest = options.nearestReach || findNearestReach(lat, lon, options);

  return buildSuggestionFromNearest(nearest, { maxDistanceM, accuracyM });
}

export function suggestRiverWithReach(lat, lon, options = {}) {
  const maxDistanceM = options.maxDistanceM || DEFAULT_MAX_DISTANCE_M;
  const accuracyM = options.accuracyM ?? null;
  const nearest = options.nearestReach || findNearestReach(lat, lon, options);

  return {
    river: buildSuggestionFromNearest(nearest, { maxDistanceM, accuracyM }),
    reach: nearest?.reach || null
  };
}

function selectDefaultReach(reaches) {
  if (!reaches || reaches.length === 0) return null;
  const withRank = reaches
    .slice()
    .sort((a, b) => (a.reach_rank || 1) - (b.reach_rank || 1));
  const midIndex = Math.floor((withRank.length - 1) / 2);
  return withRank[midIndex];
}

export function findRiverByName(name, options = {}) {
  if (!name) {
    return null;
  }
  const dataset = getDataset(options.rivers);
  const target = name.trim().toLowerCase();
  const matches = dataset.filter((reach) => matchesRiverName(reach, target));
  if (matches.length === 0) {
    return null;
  }
  const match = selectDefaultReach(matches);
  if (!match) {
    return null;
  }
  return {
    lat: match.lat,
    lon: match.lon,
    name: match.river_name,
    river_id: match.river_id,
    reach_id: match.reach_id,
    reach_label: match.reach_label
  };
}

export function findReachById(reachId, options = {}) {
  if (!reachId) {
    return null;
  }
  const dataset = getDataset(options.rivers);
  const match = dataset.find((reach) => reach.reach_id === reachId);
  if (!match) {
    return null;
  }
  let total = 1;
  if (typeof match.reach_label === "string") {
    const capture = match.reach_label.match(/reach_(\d+)_of_(\d+)/);
    if (capture) {
      total = Number(capture[2]) || 1;
    }
  }
  const sectionLabel = sectionLabelForRank(match.reach_rank || 1, total);
  return {
    lat: match.lat,
    lon: match.lon,
    name: match.river_name,
    river_id: match.river_id,
    reach_id: match.reach_id,
    reach_label: match.reach_label,
    section_label: sectionLabel
  };
}
