import test from "node:test";
import assert from "node:assert/strict";
import { suggestRiver, haversineDistance } from "../river_suggestion.js";

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
