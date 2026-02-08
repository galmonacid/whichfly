import test from "node:test";
import assert from "node:assert/strict";
import { buildRuntimePrompt, callOpenAiResponses } from "../llm_client.js";

function mockFetch(payload) {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return payload;
    }
  });
}

test("callOpenAiResponses extracts output_text", async () => {
  const payload = {
    output: [
      {
        type: "message",
        content: [
          { type: "output_text", text: "{\"ok\":true}" }
        ]
      }
    ]
  };

  const text = await callOpenAiResponses({
    systemPrompt: "sys",
    userPrompt: { test: true },
    schema: { type: "object" },
    model: "gpt-4o-mini",
    apiKey: "test-key",
    fetchImpl: mockFetch(payload)
  });

  assert.equal(text, "{\"ok\":true}");
});

test("buildRuntimePrompt caps grounding_snippets and omits allowlist", () => {
  const prompt = buildRuntimePrompt({
    river: { name: "River Wye" },
    inputs: { water_level: "Normal" },
    context: { weather: {}, daylight: {} },
    groundingSnippets: [
      { id: "1" },
      { id: "2" },
      { id: "3" },
      { id: "4" },
      { id: "5" },
      { id: "6" }
    ],
    mode: "right_now"
  });

  assert.equal(prompt.mode, "right_now");
  assert.ok(Array.isArray(prompt.grounding_snippets));
  assert.equal(prompt.grounding_snippets.length, 5);
  assert.equal("allowlist" in prompt, false);
});
