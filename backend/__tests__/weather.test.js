import test from "node:test";
import assert from "node:assert/strict";
import { fetchWeather, fetchWeatherForecast } from "../weather.js";

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

test("fetchWeatherForecast returns daily summary", async () => {
  const fetchImpl = mockFetchOk({
    daily: {
      time: ["2026-02-10"],
      temperature_2m_max: [8],
      temperature_2m_min: [2],
      precipitation_sum: [1.2],
      cloud_cover_mean: [60],
      wind_speed_10m_max: [18]
    }
  });

  const weather = await fetchWeatherForecast(51.88, -2.64, "2026-02-10", { fetchImpl });
  assert.deepEqual(weather, {
    temperature: 5,
    precipitation: 1.2,
    cloudCover: 60,
    windSpeed: 18
  });
});
