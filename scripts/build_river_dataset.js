import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const GB_PATH = process.env.GB_RIVERS_GEOJSON || path.join(projectRoot, "data", "sources", "gb_open_rivers.geojson");
const NI_PATH = process.env.NI_RIVERS_GEOJSON || path.join(projectRoot, "data", "sources", "ni_rivers.geojson");
const OUT_PATH = process.env.RIVER_DATASET_OUT || path.join(projectRoot, "data", "uk_river_reaches.json");

const GB_NAME_FIELDS = (process.env.GB_NAME_FIELDS || "name,Name").split(",").map((field) => field.trim()).filter(Boolean);
const NI_NAME_FIELDS = (process.env.NI_NAME_FIELDS || "name,Name").split(",").map((field) => field.trim()).filter(Boolean);

const EARTH_RADIUS_M = 6371000;
const LONG_RIVER_M = 80000;
const MEDIUM_RIVER_M = 30000;

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

function lineLength(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    total += haversineDistance(lat1, lon1, lat2, lon2);
  }
  return total;
}

function coordinateAtDistance(coords, targetDistance) {
  let travelled = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    const segmentLength = haversineDistance(lat1, lon1, lat2, lon2);
    if (travelled + segmentLength >= targetDistance) {
      const ratio = segmentLength === 0 ? 0 : (targetDistance - travelled) / segmentLength;
      const lon = lon1 + (lon2 - lon1) * ratio;
      const lat = lat1 + (lat2 - lat1) * ratio;
      return [lon, lat];
    }
    travelled += segmentLength;
  }
  return coords[coords.length - 1];
}

function collectLineStrings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") {
    return [geometry.coordinates];
  }
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates;
  }
  return [];
}

function extractName(properties, fields) {
  if (!properties) return null;
  for (const field of fields) {
    const value = properties[field];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function loadGeoJson(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing required source file: ${filePath}`);
  }
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function reachCountForLength(lengthM) {
  if (lengthM > LONG_RIVER_M) return 3;
  if (lengthM > MEDIUM_RIVER_M) return 2;
  return 1;
}

function addReaches(bucket, riverName, coords, source) {
  if (!coords || coords.length < 2) return;
  const lengthM = lineLength(coords);
  const reachCount = reachCountForLength(lengthM);
  for (let i = 0; i < reachCount; i += 1) {
    const start = (i / reachCount) * lengthM;
    const end = ((i + 1) / reachCount) * lengthM;
    const midpoint = (start + end) / 2;
    const [lon, lat] = coordinateAtDistance(coords, midpoint);
    bucket.push({
      river_name: riverName,
      lat,
      lon,
      source
    });
  }
}

function ingestDataset({ geojson, nameFields, sourceLabel }) {
  const buckets = new Map();
  const features = geojson.features || [];
  let skipped = 0;

  for (const feature of features) {
    const riverName = extractName(feature.properties, nameFields);
    if (!riverName) {
      skipped += 1;
      continue;
    }
    const lines = collectLineStrings(feature.geometry);
    if (lines.length === 0) {
      skipped += 1;
      continue;
    }
    const bucket = buckets.get(riverName) || [];
    for (const coords of lines) {
      addReaches(bucket, riverName, coords, sourceLabel);
    }
    buckets.set(riverName, bucket);
  }

  return { buckets, skipped };
}

function mergeBuckets(target, incoming) {
  for (const [riverName, entries] of incoming.entries()) {
    const existing = target.get(riverName) || [];
    target.set(riverName, existing.concat(entries));
  }
}

function buildOutput(buckets) {
  const output = [];
  for (const [riverName, entries] of buckets.entries()) {
    const riverId = slugify(riverName) || "river";
    const total = entries.length || 1;
    entries.forEach((entry, index) => {
      const rank = index + 1;
      const label = total === 1 ? "single" : `reach_${rank}_of_${total}`;
      output.push({
        river_id: riverId,
        river_name: riverName,
        reach_id: `${riverId}-${rank}`,
        reach_label: label,
        reach_rank: rank,
        lat: entry.lat,
        lon: entry.lon,
        source: entry.source
      });
    });
  }
  return output;
}

function main() {
  const buckets = new Map();

  const gbData = loadGeoJson(GB_PATH);
  const niData = loadGeoJson(NI_PATH);

  const gbResult = ingestDataset({
    geojson: gbData,
    nameFields: GB_NAME_FIELDS,
    sourceLabel: "os_open_rivers"
  });
  const niResult = ingestDataset({
    geojson: niData,
    nameFields: NI_NAME_FIELDS,
    sourceLabel: "ni_rivers"
  });

  mergeBuckets(buckets, gbResult.buckets);
  mergeBuckets(buckets, niResult.buckets);

  const output = buildOutput(buckets);

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} reach entries to ${OUT_PATH}`);
  console.log(`Skipped ${gbResult.skipped + niResult.skipped} features without names/lines.`);
  console.log("TODO: If reach ordering matters, add hydrology-aware ordering before release.");
}

main();
