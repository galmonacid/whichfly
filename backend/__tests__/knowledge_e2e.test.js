import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createServer } from "../server.js";

function request(server, { url, method = "GET", body }) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = Readable.from(payload ? [payload] : []);
    req.url = url;
    req.method = method;
    req.headers = payload
      ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) }
      : {};

    const res = {
      statusCode: null,
      headers: {},
      writeHead(code, headers) {
        this.statusCode = code;
        this.headers = { ...headers };
      },
      end(chunk = "") {
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: chunk
        });
      }
    };

    server.emit("request", req, res);
  });
}

function makeValidModelResponse() {
  return {
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              river: {
                name: "River Test",
                source: "user_selected",
                confidence: "high",
                distance_m: null
              },
              primary: { pattern: "Pheasant Tail Nymph", type: "nymph", size: 16 },
              alternatives: [
                {
                  when: "If you see surface activity",
                  pattern: "Elk Hair Caddis",
                  type: "dry",
                  size: 14
                }
              ],
              explanation: "A conservative nymph start for typical UK river conditions.",
              confidence: "medium",
              confidence_reasons: ["Generic safety-first choice"],
              context_used: {
                weather: {
                  temperature_c: null,
                  precipitation_mm: null,
                  cloud_cover_pct: null,
                  wind_speed_kph: null
                },
                daylight: {
                  is_daylight: null,
                  minutes_to_sunset: null
                }
              },
              meta: {
                version: "0.1",
                mode: "right_now",
                generated_at: "2026-02-08T12:00:00.000Z"
              }
            })
          }
        ]
      }
    ]
  };
}

test("E2E: /api/recommendation passes grounding_snippets to OpenAI", async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;

  let capturedUserPrompt = null;

  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    const userMessage = body.input.find((msg) => msg.role === "user");
    capturedUserPrompt = JSON.parse(userMessage.content);
    return {
      ok: true,
      status: 200,
      async json() {
        return makeValidModelResponse();
      }
    };
  };

  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-4o-mini";

  try {
    const server = createServer();
    const response = await request(server, {
      url: "/api/recommendation",
      method: "POST",
      body: {
        waterLevel: "normal",
        riverName: "River Test",
        observations: { fishRising: false }
      }
    });

    assert.equal(response.statusCode, 200);
    assert.ok(capturedUserPrompt);
    assert.ok(Array.isArray(capturedUserPrompt.grounding_snippets));
    assert.ok(capturedUserPrompt.grounding_snippets.length <= 4);
    assert.ok(capturedUserPrompt.grounding_snippets.length > 0);
    assert.equal("allowlist" in capturedUserPrompt, false);
    assert.ok(
      capturedUserPrompt.grounding_snippets.every(
        (snippet) =>
          "id" in snippet &&
          "summary" in snippet &&
          "confidence" in snippet &&
          "tags" in snippet &&
          !("sources" in snippet) &&
          !("scope" in snippet)
      )
    );
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalKey;
    process.env.OPENAI_MODEL = originalModel;
  }
});
