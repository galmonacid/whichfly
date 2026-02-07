import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const riversPath = path.resolve(__dirname, "..", "data", "uk_rivers_min.json");
const rivers = JSON.parse(readFileSync(riversPath, "utf-8"));

const EARTH_RADIUS_M = 6371000;
const DEFAULT_MAX_DISTANCE_M = 30000;

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

export function suggestRiver(lat, lon, options = {}) {
  const dataset = options.rivers || rivers;
  const maxDistanceM = options.maxDistanceM || DEFAULT_MAX_DISTANCE_M;
  const accuracyM = options.accuracyM ?? null;

  let best = null;

  for (const river of dataset) {
    const distanceM = haversineDistance(lat, lon, river.lat, river.lon);
    if (!best || distanceM < best.distance_m) {
      best = {
        name: river.name,
        distance_m: distanceM
      };
    }
  }

  if (!best || best.distance_m > maxDistanceM) {
    return {
      name: "Unknown",
      confidence: "low",
      source: "unknown",
      distance_m: null
    };
  }

  let confidence = confidenceForDistance(best.distance_m);

  if (accuracyM !== null) {
    if (accuracyM > 1000 && best.distance_m > 15000) {
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
    name: best.name,
    confidence,
    distance_m: Math.round(best.distance_m),
    source: "gps_suggested"
  };
}
