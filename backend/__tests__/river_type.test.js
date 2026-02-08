import test from "node:test";
import assert from "node:assert/strict";
import { deriveRegionFromCoords, deriveRiverType } from "../river_type.js";

test("deriveRiverType returns chalkstream for known list entries", () => {
  const result = deriveRiverType("River Test", null);
  assert.equal(result.type, "chalkstream");
  assert.equal(result.confidence, "high");
  assert.equal(result.source, "lookup");
});

test("deriveRiverType returns mixed for southern regions when not in list", () => {
  const result = deriveRiverType("River Mole", "south");
  assert.equal(result.type, "mixed");
  assert.equal(result.confidence, "low");
});

test("deriveRiverType returns freestone for non-listed rivers outside south", () => {
  const result = deriveRiverType("River Dee", "north");
  assert.equal(result.type, "freestone");
  assert.equal(result.confidence, "low");
});

test("deriveRiverType returns unknown when river name is missing", () => {
  const result = deriveRiverType(null, "south");
  assert.equal(result.type, "unknown");
});

test("deriveRegionFromCoords returns south_east for London-ish coords", () => {
  const region = deriveRegionFromCoords(51.5, -0.1);
  assert.equal(region, "south_east");
});

test("deriveRegionFromCoords returns south for Bristol-ish coords", () => {
  const region = deriveRegionFromCoords(51.45, -2.6);
  assert.equal(region, "south");
});

test("deriveRegionFromCoords returns null for northern coords", () => {
  const region = deriveRegionFromCoords(53.48, -2.24);
  assert.equal(region, null);
});
