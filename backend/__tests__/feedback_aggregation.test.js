import test from "node:test";
import assert from "node:assert/strict";
import { aggregateFeedback } from "../feedback_aggregation.js";

test("aggregateFeedback computes success rates and top patterns", () => {
  const events = [
    {
      received_at: "2026-02-01T10:00:00.000Z",
      outcome: "up",
      confidence: "high",
      fly_type: "nymph",
      pattern: "Pheasant Tail Nymph",
      river_name: "River Test"
    },
    {
      received_at: "2026-02-02T10:00:00.000Z",
      outcome: "down",
      confidence: "high",
      fly_type: "nymph",
      pattern: "Pheasant Tail Nymph",
      river_name: "River Test"
    },
    {
      received_at: "2026-02-03T10:00:00.000Z",
      outcome: "up",
      confidence: "medium",
      fly_type: "dry",
      pattern: "Elk Hair Caddis",
      river_name: "River Test"
    }
  ];

  const summary = aggregateFeedback(events, {
    resolveRegion: () => "south"
  });

  assert.equal(summary.overall.total, 3);
  assert.equal(summary.success_rates.by_confidence.high.total, 2);
  assert.equal(summary.success_rates.by_confidence.medium.total, 1);
  assert.equal(summary.success_rates.by_method.nymph.total, 2);
  assert.equal(summary.success_rates.by_method.dry.total, 1);

  const winterTop = summary.top_patterns.by_season.winter;
  assert.ok(winterTop.some((entry) => entry.pattern === "Pheasant Tail Nymph"));
  assert.ok(winterTop.some((entry) => entry.pattern === "Elk Hair Caddis"));

  const southTop = summary.top_patterns.by_region.south;
  assert.ok(southTop.some((entry) => entry.pattern === "Pheasant Tail Nymph"));
});

test("aggregateFeedback ignores invalid outcomes and empty inputs", () => {
  const events = [
    { outcome: "up", received_at: "2026-02-01T10:00:00.000Z" },
    { outcome: "maybe", received_at: "2026-02-01T10:00:00.000Z" }
  ];

  const summary = aggregateFeedback(events);
  assert.equal(summary.overall.total, 1);
});
