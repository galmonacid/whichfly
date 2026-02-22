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

test("POST /api/recommendation accepts planning payload", async () => {
  const server = createServer();
  const response = await request(server, {
    url: "/api/recommendation",
    method: "POST",
    body: {
      mode: "planning",
      plannedDate: "2026-02-10",
      riverName: "River Test"
    }
  });

  assert.equal(response.statusCode, 200);
  const data = JSON.parse(response.body);
  assert.equal(data.meta.mode, "planning");
});

test("POST /api/recommendation accepts legacy right_now mode as alias", async () => {
  const server = createServer();
  const response = await request(server, {
    url: "/api/recommendation",
    method: "POST",
    body: {
      mode: "right_now",
      waterLevel: "normal",
      riverName: "River Wye"
    }
  });

  assert.equal(response.statusCode, 200);
  const data = JSON.parse(response.body);
  assert.equal(data.meta.mode, "by_the_riverside");
});

test("POST /api/recommendation rejects planning payload without date", async () => {
  const server = createServer();
  const response = await request(server, {
    url: "/api/recommendation",
    method: "POST",
    body: {
      mode: "planning",
      riverName: "River Test"
    }
  });

  assert.equal(response.statusCode, 400);
  const data = JSON.parse(response.body);
  assert.equal(data.error, "Invalid request");
});

test("GET /api/rivers returns a river list", async () => {
  const server = createServer();
  const response = await request(server, { url: "/api/rivers", method: "GET" });

  assert.equal(response.statusCode, 200);
  const data = JSON.parse(response.body);
  assert.ok(Array.isArray(data.options));
  assert.ok(data.options.length > 0);
  assert.ok(data.options[0].label);
});

test("POST /api/river-suggestion returns a suggestion", async () => {
  const server = createServer();
  const response = await request(server, {
    url: "/api/river-suggestion",
    method: "POST",
    body: { gps: { lat: 52.0, lon: -3.0, accuracy: 30 } }
  });

  assert.equal(response.statusCode, 200);
  const data = JSON.parse(response.body);
  assert.ok(data.river);
  assert.ok(data.river.name);
});

test("POST /api/feedback accepts a valid payload", async () => {
  const server = createServer();
  const response = await request(server, {
    url: "/api/feedback",
    method: "POST",
    body: {
      recommendationId: "rec_123",
      riverName: "River Test",
      sessionId: "sess_abc",
      outcome: "up",
      context: {
        mode: "by_the_riverside",
        waterLevel: "normal",
        confidence: "medium"
      }
    }
  });

  assert.equal(response.statusCode, 200);
  const data = JSON.parse(response.body);
  assert.equal(data.ok, true);
});

test("POST /api/feedback rejects invalid payload", async () => {
  const server = createServer();
  const response = await request(server, {
    url: "/api/feedback",
    method: "POST",
    body: {
      riverName: "River Test",
      sessionId: "sess_abc"
    }
  });

  assert.equal(response.statusCode, 400);
  const data = JSON.parse(response.body);
  assert.equal(data.error, "Invalid request");
});

test("POST /api/feedback accepts legacy right_now context mode", async () => {
  const server = createServer();
  const response = await request(server, {
    url: "/api/feedback",
    method: "POST",
    body: {
      recommendationId: "rec_456",
      riverName: "River Test",
      sessionId: "sess_legacy",
      outcome: "up",
      context: {
        mode: "right_now",
        waterLevel: "normal"
      }
    }
  });

  assert.equal(response.statusCode, 200);
  const data = JSON.parse(response.body);
  assert.equal(data.ok, true);
});
