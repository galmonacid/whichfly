import test from "node:test";
import assert from "node:assert/strict";
import { fetchWeather } from "../weather.js";

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
  return async () => ({ ok: false, status: 503, json: async () => ({}) });
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

test("fetchWeather returns current conditions on success", async () => {
  const fetchImpl = mockFetchOk({
    current: {
      temperature_2m: 12.3,
      precipitation: 0.1,
      cloud_cover: 40
    }
  });

  const weather = await fetchWeather(51.88, -2.64, { fetchImpl });
  assert.deepEqual(weather, {
    temperature: 12.3,
    precipitation: 0.1,
    cloudCover: 40
  });
});

test("fetchWeather returns null on non-200", async () => {
  const weather = await fetchWeather(51.88, -2.64, { fetchImpl: mockFetchNotOk() });
  assert.equal(weather, null);
});

test("fetchWeather returns null on timeout", async () => {
  const weather = await fetchWeather(51.88, -2.64, {
    fetchImpl: mockFetchAbortable(),
    timeoutMs: 5
  });
  assert.equal(weather, null);
});
