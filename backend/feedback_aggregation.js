import { deriveSeasonFromDate } from "./season.js";
import { findReachById, findRiverByName } from "./river_suggestion.js";
import { deriveRegionFromCoords } from "./river_type.js";

const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);
const METHOD_TYPES = new Set(["dry", "nymph", "streamer", "wet", "emerger"]);

function normalizeKey(value, allowedSet) {
  if (!value || typeof value !== "string") {
    return "unknown";
  }
  const normalized = value.toLowerCase();
  return allowedSet.has(normalized) ? normalized : "unknown";
}

function normalizeOutcome(value) {
  return value === "up" || value === "down" ? value : null;
}

function createStats() {
  return { up: 0, down: 0, total: 0, success_rate: 0 };
}

function recordOutcome(stats, outcome) {
  if (outcome === "up") {
    stats.up += 1;
  } else if (outcome === "down") {
    stats.down += 1;
  }
  stats.total = stats.up + stats.down;
  stats.success_rate = stats.total > 0 ? stats.up / stats.total : 0;
}

function recordStat(map, key, outcome) {
  if (!map.has(key)) {
    map.set(key, createStats());
  }
  recordOutcome(map.get(key), outcome);
}

function resolveRegionFromEvent(event) {
  if (event?.river_reach_id) {
    const reach = findReachById(event.river_reach_id);
    if (reach) {
      return deriveRegionFromCoords(reach.lat, reach.lon);
    }
  }
  if (event?.river_name) {
    const river = findRiverByName(event.river_name);
    if (river) {
      return deriveRegionFromCoords(river.lat, river.lon);
    }
  }
  return null;
}

export function aggregateFeedback(events, { resolveRegion } = {}) {
  const byConfidence = new Map();
  const bySeason = new Map();
  const byMethod = new Map();
  const patternBySeason = new Map();
  const patternByRegion = new Map();

  let earliest = null;
  let latest = null;
  const overall = createStats();

  for (const event of events || []) {
    const outcome = normalizeOutcome(event?.outcome);
    if (!outcome) {
      continue;
    }

    const confidence = normalizeKey(event?.confidence, CONFIDENCE_LEVELS);
    const method = normalizeKey(event?.fly_type, METHOD_TYPES);
    const season = event?.planned_date
      ? deriveSeasonFromDate(event.planned_date)
      : deriveSeasonFromDate(event?.received_at);
    const seasonKey = season || "unknown";
    const regionValue = resolveRegion ? resolveRegion(event) : resolveRegionFromEvent(event);
    const regionKey = regionValue || "unknown";

    recordOutcome(overall, outcome);
    recordStat(byConfidence, confidence, outcome);
    recordStat(bySeason, seasonKey, outcome);
    recordStat(byMethod, method, outcome);

    const pattern = typeof event?.pattern === "string" ? event.pattern : null;
    if (pattern) {
      const seasonMap = patternBySeason.get(seasonKey) || new Map();
      recordStat(seasonMap, pattern, outcome);
      patternBySeason.set(seasonKey, seasonMap);

      const regionMap = patternByRegion.get(regionKey) || new Map();
      recordStat(regionMap, pattern, outcome);
      patternByRegion.set(regionKey, regionMap);
    }

    if (event?.received_at) {
      const ts = new Date(event.received_at).toISOString();
      earliest = earliest ? (ts < earliest ? ts : earliest) : ts;
      latest = latest ? (ts > latest ? ts : latest) : ts;
    }
  }

  const serializeStatsMap = (map) => {
    const result = {};
    for (const [key, stats] of map.entries()) {
      result[key] = { ...stats };
    }
    return result;
  };

  const topPatterns = (map) => {
    const result = {};
    for (const [key, statsMap] of map.entries()) {
      const entries = Array.from(statsMap.entries()).map(([pattern, stats]) => ({
        pattern,
        ...stats
      }));
      entries.sort((a, b) => {
        if (a.success_rate !== b.success_rate) {
          return b.success_rate - a.success_rate;
        }
        if (a.total !== b.total) {
          return b.total - a.total;
        }
        return a.pattern.localeCompare(b.pattern);
      });
      result[key] = entries.slice(0, 5);
    }
    return result;
  };

  return {
    version: "0.1",
    generated_at: new Date().toISOString(),
    window: {
      from: earliest,
      to: latest,
      total_events: overall.total
    },
    overall,
    success_rates: {
      by_confidence: serializeStatsMap(byConfidence),
      by_season: serializeStatsMap(bySeason),
      by_method: serializeStatsMap(byMethod)
    },
    top_patterns: {
      by_season: topPatterns(patternBySeason),
      by_region: topPatterns(patternByRegion)
    }
  };
}
