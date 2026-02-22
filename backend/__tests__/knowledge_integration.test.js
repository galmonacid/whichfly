import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRiverIndex,
  compileGroundingSnippets,
  selectGroundingSnippets
} from "../knowledge.js";
import { buildRuntimePrompt } from "../llm_client.js";

function makeSnippet(overrides = {}) {
  return {
    id: "snippet_base",
    scope: {
      country: "UK",
      region: "unknown",
      river: null,
      river_type: ["unknown"],
      season: ["unknown"]
    },
    kind: "general_guidance",
    summary: "A safe summary that is long enough to satisfy snippet schema rules.",
    confidence: "medium",
    tags: ["baseline"],
    use_as: "background_only",
    sources: [{ type: "guide", ref: "Test source" }],
    created_at: "2026-02-08",
    ...overrides
  };
}

test("knowledge pipeline produces runtime prompt with capped snippets", () => {
  const dataset = [
    { river_id: "river-test", river_name: "River Test" }
  ];
  const index = buildRiverIndex(dataset);
  const snippets = [
    makeSnippet({ id: "safety", kind: "safety_note", confidence: "high" }),
    makeSnippet({ id: "river_guidance", kind: "river_type_guidance", confidence: "medium" }),
    makeSnippet({ id: "general_a", kind: "general_guidance", confidence: "high" }),
    makeSnippet({ id: "general_b", kind: "general_guidance", confidence: "low" }),
    makeSnippet({ id: "report", kind: "angler_reports", confidence: "low" })
  ];

  const compiled = compileGroundingSnippets(snippets, index);
  const selected = selectGroundingSnippets(compiled, {
    riverName: "River Test",
    riverId: "river-test",
    riverType: "unknown",
    season: "unknown"
  });

  const prompt = buildRuntimePrompt({
    river: { name: "River Test" },
    inputs: { water_level: "Normal" },
    context: { weather: {}, daylight: {} },
    groundingSnippets: selected,
    mode: "by_the_riverside"
  });

  assert.ok(Array.isArray(prompt.grounding_snippets));
  assert.equal(prompt.grounding_snippets.length, 4);
  assert.ok(prompt.grounding_snippets.every((item) => "summary" in item));
  assert.ok(prompt.grounding_snippets.every((item) => !("sources" in item)));
});

test("compileGroundingSnippets fails fast on unknown river_id", () => {
  const dataset = [{ river_id: "river-test", river_name: "River Test" }];
  const index = buildRiverIndex(dataset);
  const snippets = [
    makeSnippet({
      id: "bad_river",
      scope: {
        country: "UK",
        region: "unknown",
        river_id: "missing-id",
        river: null,
        river_type: ["unknown"],
        season: ["unknown"]
      }
    })
  ];

  assert.throws(() => compileGroundingSnippets(snippets, index), /Unknown river_id/);
});
