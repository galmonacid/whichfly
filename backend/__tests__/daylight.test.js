import test from "node:test";
import assert from "node:assert/strict";
import { computeDaylightContext, fetchDaylight } from "../daylight.js";

function mockFetchOk(body) {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return body;
    }
  });
}

function mockFetchNotOk() {
  return async () => ({ ok: false, status: 500, json: async () => ({}) });
}

function mockFetchAbortable() {
  return async (_url, { signal }) => {
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      });
    });
  };
}

test("computeDaylightContext returns derived fields", () => {
  const context = computeDaylightContext({
    now: "2025-06-01T12:00:00.000Z",
    sunrise: "2025-06-01T04:30:00.000Z",
    sunset: "2025-06-01T21:00:00.000Z"
  });

  assert.deepEqual(context, {
    isDaylight: true,
    minutesToSunset: 540,
    sunriseISO: "2025-06-01T04:30:00.000Z",
    sunsetISO: "2025-06-01T21:00:00.000Z"
  });
});

test("fetchDaylight returns null on non-200", async () => {
  const daylight = await fetchDaylight(51.88, -2.64, { fetchImpl: mockFetchNotOk() });
  assert.equal(daylight, null);
});

test("fetchDaylight returns null on timeout", async () => {
  const daylight = await fetchDaylight(51.88, -2.64, {
    fetchImpl: mockFetchAbortable(),
    timeoutMs: 5
  });
  assert.equal(daylight, null);
});

test("fetchDaylight returns context on success", async () => {
  const fetchImpl = mockFetchOk({
    results: {
      sunrise: "2025-06-01T04:30:00.000Z",
      sunset: "2025-06-01T21:00:00.000Z"
    }
  });

  const daylight = await fetchDaylight(51.88, -2.64, {
    fetchImpl,
    now: "2025-06-01T12:00:00.000Z"
  });
  assert.equal(daylight.isDaylight, true);
  assert.equal(daylight.minutesToSunset > 0, true);
  assert.equal(daylight.sunriseISO, "2025-06-01T04:30:00.000Z");
  assert.equal(daylight.sunsetISO, "2025-06-01T21:00:00.000Z");
});
