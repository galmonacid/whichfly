import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findRiverByName,
  haversineDistance,
  listRiverOptions,
  suggestRiver,
  suggestRiverWithReach
} from "../river_suggestion.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleDatasetPath = path.resolve(__dirname, "..", "..", "data", "fixtures", "river_reaches_sample.json");
const sampleDataset = JSON.parse(readFileSync(sampleDatasetPath, "utf-8"));

test("haversineDistance returns zero for same point", () => {
  const distance = haversineDistance(51.5, -1.0, 51.5, -1.0);
  assert.equal(Math.round(distance), 0);
});

test("suggestRiver picks nearest within threshold", () => {
  const rivers = [
    { name: "Alpha", lat: 51.5, lon: -1.0 },
    { name: "Bravo", lat: 52.0, lon: -1.0 }
  ];

  const result = suggestRiver(51.51, -1.01, { rivers, maxDistanceM: 30000 });
  assert.equal(result.name, "Alpha");
  assert.equal(result.source, "gps_suggested");
  assert.equal(result.confidence, "high");
});

test("suggestRiver returns Unknown when outside threshold", () => {
  const rivers = [{ name: "Alpha", lat: 51.5, lon: -1.0 }];

  const result = suggestRiver(55.0, -1.0, { rivers, maxDistanceM: 10000 });
  assert.equal(result.name, "Unknown");
  assert.equal(result.distance_m, null);
  assert.equal(result.confidence, "low");
});

test("suggestRiver degrades confidence when accuracy is poor", () => {
  const rivers = [{ name: "Alpha", lat: 51.5, lon: -1.0 }];

  const result = suggestRiver(51.5005, -1.0005, {
    rivers,
    maxDistanceM: 30000,
    accuracyM: 500
  });

  assert.equal(result.name, "Alpha");
  assert.equal(result.confidence, "medium");
});

test("suggestRiver returns Unknown when accuracy is very poor and distance is far", () => {
  const rivers = [{ name: "Alpha", lat: 51.5, lon: -1.0 }];

  const result = suggestRiver(51.75, -1.0, {
    rivers,
    maxDistanceM: 30000,
    accuracyM: 2000
  });

  assert.equal(result.name, "Unknown");
  assert.equal(result.confidence, "low");
  assert.equal(result.source, "unknown");
  assert.equal(result.distance_m, null);
});

test("findRiverByName returns middle reach for multi-reach river", () => {
  const result = findRiverByName("River Wye", { rivers: sampleDataset });
  assert.ok(result);
  assert.equal(result.name, "River Wye");
  assert.equal(result.reach_id, "river-wye-2");
  assert.equal(result.reach_label, "reach_2_of_3");
});

test("findRiverByName can resolve NI river entries", () => {
  const result = findRiverByName("River Bann", { rivers: sampleDataset });
  assert.ok(result);
  assert.equal(result.name, "River Bann");
  assert.equal(result.reach_label, "single");
});

test("findRiverByName matches alternate river names", () => {
  const result = findRiverByName("Afon Wysg", { rivers: sampleDataset });
  assert.ok(result);
  assert.equal(result.name, "River Usk");
});

test("listRiverOptions expands multi-reach rivers with sections", () => {
  const options = listRiverOptions({ rivers: sampleDataset });
  const wyeOptions = options.filter((option) => option.river_name === "River Wye");
  assert.equal(wyeOptions.length, 3);
  const labels = wyeOptions.map((option) => option.label);
  assert.ok(labels.some((label) => label.includes("Upper section")));
  assert.ok(labels.some((label) => label.includes("Middle section")));
  assert.ok(labels.some((label) => label.includes("Lower section")));
});

test("suggestRiverWithReach returns reach metadata for context", () => {
  const result = suggestRiverWithReach(52.24, -3.03, { rivers: sampleDataset });
  assert.equal(result.river.name, "River Wye");
  assert.ok(result.reach);
  assert.equal(result.reach.reach_id, "river-wye-2");
});
