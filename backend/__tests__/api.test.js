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

test("POST /api/recommendation returns mocked payload", async () => {
  const server = createServer();
  const response = await request(server, {
    url: "/api/recommendation",
    method: "POST",
    body: {
      waterLevel: "normal",
      riverName: "River Wye",
      gps: { lat: 51.88, lon: -2.64, accuracy: 12 }
    }
  });

  assert.equal(response.statusCode, 200);
  const data = JSON.parse(response.body);

  assert.equal(data.riverSuggestion, "River Wye (suggested)");
  assert.equal(data.primaryFly.pattern, "Pheasant Tail");
  assert.ok(Array.isArray(data.alternatives));
});

test("POST /api/recommendation rejects invalid payload", async () => {
  const server = createServer();
  const response = await request(server, {
    url: "/api/recommendation",
    method: "POST",
    body: { waterLevel: "fast" }
  });

  assert.equal(response.statusCode, 400);
  const data = JSON.parse(response.body);
  assert.equal(data.error, "Invalid request");
});
