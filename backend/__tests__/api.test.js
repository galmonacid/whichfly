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
      observations: { fishRising: true }
    }
  });

  assert.equal(response.statusCode, 200);
  const data = JSON.parse(response.body);

  assert.equal(data.river.name, "River Wye");
  assert.equal(data.river.source, "user_selected");
  assert.equal(data.primary.pattern, "Pheasant Tail Nymph");
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

test("POST /api/recommendation rejects empty body", async () => {
  const server = createServer();
  const response = await request(server, {
    url: "/api/recommendation",
    method: "POST",
    body: null
  });

  assert.equal(response.statusCode, 400);
  const data = JSON.parse(response.body);
  assert.equal(data.error, "Invalid request");
});
