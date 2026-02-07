import test from "node:test";
import assert from "node:assert/strict";
import { callOpenAiResponses } from "../llm_client.js";

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
