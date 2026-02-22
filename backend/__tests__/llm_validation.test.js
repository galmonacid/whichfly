import test from "node:test";
import assert from "node:assert/strict";
import { validateByTheRiversideResponse } from "../llm_validation.js";

test("validateByTheRiversideResponse accepts a valid response", () => {
  const payload = {
    river: {
      name: "River Wye",
      source: "gps_suggested",
      confidence: "medium",
      distance_m: 12000
    },
    primary: {
      pattern: "Pheasant Tail Nymph",
      type: "nymph",
      size: 16
    },
    alternatives: [
      {
        when: "If you see surface activity",
        pattern: "Elk Hair Caddis",
        type: "dry",
        size: 14
      }
    ],
    explanation: "A reliable nymph covers most UK river trout in mixed conditions.",
    confidence: "medium",
    confidence_reasons: ["Generic river suggestion only"],
    context_used: {
      weather: {
        temperature_c: 12,
        precipitation_mm: 0.1,
        cloud_cover_pct: 40,
        wind_speed_kph: null
      },
      daylight: {
        is_daylight: true,
        minutes_to_sunset: 120
      }
    },
    meta: {
      version: "0.1",
      mode: "by_the_riverside",
      generated_at: "2025-06-01T12:00:00.000Z"
    }
  };

  const result = validateByTheRiversideResponse(payload);
  assert.equal(result.ok, true);
});

test("validateByTheRiversideResponse rejects missing required fields", () => {
  const payload = {
    river: {
      name: "River Wye",
      source: "gps_suggested",
      confidence: "medium",
      distance_m: null
    }
  };

  const result = validateByTheRiversideResponse(payload);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("response.primary is required")));
  assert.ok(result.errors.some((error) => error.includes("context_used is required")));
});

test("validateByTheRiversideResponse rejects patterns not in allowlist", () => {
  const payload = {
    river: {
      name: "River Wye",
      source: "gps_suggested",
      confidence: "medium"
    },
    primary: {
      pattern: "Mystery Bug",
      type: "nymph",
      size: 16
    },
    alternatives: [
      {
        when: "If you see surface activity",
        pattern: "Elk Hair Caddis",
        type: "dry",
        size: 14
      }
    ],
    explanation: "A reliable nymph covers most UK river trout in mixed conditions.",
    confidence: "medium",
    confidence_reasons: ["Generic river suggestion only"],
    meta: {
      version: "0.1",
      mode: "by_the_riverside",
      generated_at: "2025-06-01T12:00:00.000Z"
    }
  };

  const allowlist = new Set(["Elk Hair Caddis"]);
  const result = validateByTheRiversideResponse(payload, { allowlist });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("primary.pattern not in allowlist")));
});
