import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRiverIndex,
  compileGroundingSnippets,
  normalizeRiverName,
  resolveSnippetScope,
  selectGroundingSnippets
} from "../knowledge.js";

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

test("selectGroundingSnippets filters by scope and treats unknown as wildcard", () => {
  const snippets = [
    makeSnippet({
      id: "chalk_summer",
      scope: {
        country: "UK",
        region: "unknown",
        river: null,
        river_type: ["chalkstream"],
        season: ["summer"]
      }
    }),
    makeSnippet({
      id: "freestone_winter",
      scope: {
        country: "UK",
        region: "unknown",
        river: null,
        river_type: ["freestone"],
        season: ["winter"]
      }
    }),
    makeSnippet({
      id: "river_specific_match",
      scope: {
        country: "UK",
        region: "unknown",
        river: "River Test",
        river_type: ["unknown"],
        season: ["summer"]
      }
    }),
    makeSnippet({
      id: "river_specific_other",
      scope: {
        country: "UK",
        region: "unknown",
        river: "River Other",
        river_type: ["unknown"],
        season: ["summer"]
      }
    }),
    makeSnippet({
      id: "wildcard_unknown",
      kind: "safety_note"
    })
  ];

  const result = selectGroundingSnippets(snippets, {
    riverName: "River Test",
    riverType: "chalkstream",
    season: "summer"
  });

  const ids = result.map((snippet) => snippet.id);
  assert.deepEqual(ids.sort(), ["chalk_summer", "river_specific_match", "wildcard_unknown"].sort());
});

test("normalizeRiverName collapses variants to a stable form", () => {
  assert.equal(normalizeRiverName("River Avon (Hampshire)"), "avon hampshire");
  assert.equal(normalizeRiverName("River Avon, Hampshire"), "avon hampshire");
  assert.equal(normalizeRiverName("R. Test"), "test");
  assert.equal(normalizeRiverName("  The River   Test "), "test");
});

test("resolveSnippetScope maps river name to a single river_id", () => {
  const dataset = [
    { river_id: "river-test", river_name: "River Test" },
    { river_id: "river-avon-hants", river_name: "River Avon (Hampshire)" }
  ];
  const index = buildRiverIndex(dataset);
  const snippet = makeSnippet({
    id: "river_specific",
    scope: {
      country: "UK",
      region: "unknown",
      river: "River Avon, Hampshire",
      river_type: ["unknown"],
      season: ["unknown"]
    }
  });

  const resolved = resolveSnippetScope(snippet, index);
  assert.equal(resolved.scope.river_id, "river-avon-hants");
});

test("resolveSnippetScope throws on ambiguous river matches", () => {
  const dataset = [
    { river_id: "avon-1", river_name: "River Avon" },
    { river_id: "avon-2", river_name: "River Avon" }
  ];
  const index = buildRiverIndex(dataset);
  const snippet = makeSnippet({
    id: "river_specific",
    scope: {
      country: "UK",
      region: "unknown",
      river: "River Avon",
      river_type: ["unknown"],
      season: ["unknown"]
    }
  });

  assert.throws(() => resolveSnippetScope(snippet, index), /Ambiguous river match/);
});

test("resolveSnippetScope respects river_id even when river name is ambiguous", () => {
  const dataset = [
    { river_id: "avon-1", river_name: "River Avon" },
    { river_id: "avon-2", river_name: "River Avon" }
  ];
  const index = buildRiverIndex(dataset);
  const snippet = makeSnippet({
    id: "river_specific",
    scope: {
      country: "UK",
      region: "unknown",
      river_id: "avon-1",
      river: "River Avon",
      river_type: ["unknown"],
      season: ["unknown"]
    }
  });

  const resolved = resolveSnippetScope(snippet, index);
  assert.equal(resolved.scope.river_id, "avon-1");
});

test("compileGroundingSnippets throws on unknown river_id", () => {
  const dataset = [{ river_id: "river-test", river_name: "River Test" }];
  const index = buildRiverIndex(dataset);
  const snippets = [
    makeSnippet({
      id: "bad_river_id",
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

test("selectGroundingSnippets falls back to safety/general when context is unknown", () => {
  const snippets = [
    makeSnippet({ id: "safety", kind: "safety_note", confidence: "high" }),
    makeSnippet({ id: "general", kind: "general_guidance", confidence: "medium" }),
    makeSnippet({
      id: "chalk_only",
      kind: "river_type_guidance",
      scope: {
        country: "UK",
        region: "unknown",
        river: null,
        river_type: ["chalkstream"],
        season: ["spring"]
      }
    })
  ];

  const result = selectGroundingSnippets(snippets, {
    riverName: null,
    riverType: "unknown",
    season: "unknown"
  });

  const ids = result.map((snippet) => snippet.id);
  assert.deepEqual(ids, ["safety", "general"]);
});

test("selectGroundingSnippets orders by confidence then id for same kind", () => {
  const snippets = [
    makeSnippet({ id: "general_b", kind: "general_guidance", confidence: "medium" }),
    makeSnippet({ id: "general_a", kind: "general_guidance", confidence: "medium" }),
    makeSnippet({ id: "general_c", kind: "general_guidance", confidence: "low" })
  ];

  const result = selectGroundingSnippets(snippets, {
    riverName: "River Test",
    riverType: "unknown",
    season: "unknown"
  });

  const ids = result.map((snippet) => snippet.id);
  assert.deepEqual(ids, ["general_a", "general_b", "general_c"]);
});

test("selectGroundingSnippets enforces kind order and limits", () => {
  const snippets = [
    makeSnippet({ id: "safety", kind: "safety_note", confidence: "high" }),
    makeSnippet({ id: "river_guidance", kind: "river_type_guidance", confidence: "medium" }),
    makeSnippet({ id: "general_high", kind: "general_guidance", confidence: "high" }),
    makeSnippet({ id: "general_low", kind: "general_guidance", confidence: "low" }),
    makeSnippet({ id: "report_high", kind: "angler_reports", confidence: "high" }),
    makeSnippet({ id: "report_low", kind: "angler_reports", confidence: "low" })
  ];

  const result = selectGroundingSnippets(snippets, {
    riverName: "River Test",
    riverType: "unknown",
    season: "unknown"
  });

  const ids = result.map((snippet) => snippet.id);
  assert.deepEqual(ids, ["safety", "river_guidance", "general_high", "general_low"]);
  assert.ok(result.length <= 4);
  assert.ok(result.every((snippet) => snippet.id !== "report_high"));
});

test("selectGroundingSnippets includes at most one angler report when space remains", () => {
  const snippets = [
    makeSnippet({ id: "safety", kind: "safety_note", confidence: "high" }),
    makeSnippet({ id: "general", kind: "general_guidance", confidence: "high" }),
    makeSnippet({ id: "report_high", kind: "angler_reports", confidence: "high" }),
    makeSnippet({ id: "report_low", kind: "angler_reports", confidence: "low" })
  ];

  const result = selectGroundingSnippets(snippets, {
    riverName: "River Test",
    riverType: "unknown",
    season: "unknown"
  });

  const reportIds = result.filter((snippet) => snippet.id.startsWith("report_"));
  assert.equal(reportIds.length, 1);
});

test("selectGroundingSnippets strips scope and sources for runtime payload", () => {
  const snippets = [makeSnippet({ id: "strip_test" })];
  const result = selectGroundingSnippets(snippets, {
    riverName: "River Test",
    riverType: "unknown",
    season: "unknown"
  });

  assert.equal(result.length, 1);
  const runtimeSnippet = result[0];
  assert.equal("scope" in runtimeSnippet, false);
  assert.equal("sources" in runtimeSnippet, false);
  assert.equal("kind" in runtimeSnippet, false);
  assert.ok(runtimeSnippet.id);
  assert.ok(runtimeSnippet.summary);
});
