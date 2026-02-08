const DEFAULT_TIMEOUT_MS = 3000;

export async function fetchWeather(lat, lon, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const logger = options.logger || (() => {});
  const baseUrl = options.baseUrl || process.env.WEATHER_API_BASE_URL || "https://api.open-meteo.com";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL("/v1/forecast", baseUrl);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("current", "temperature_2m,precipitation,cloud_cover");

    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      logger("weather fetch failed", { status: response.status });
      return null;
    }

    const payload = await response.json();
    const current = payload?.current;
    if (!current) {
      logger("weather payload missing current");
      return null;
    }

    return {
      temperature: current.temperature_2m,
      precipitation: current.precipitation,
      cloudCover: current.cloud_cover
    };
  } catch (error) {
    logger("weather fetch error", { name: error?.name || "unknown" });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchWeatherForecast(lat, lon, date, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const logger = options.logger || (() => {});
  const baseUrl = options.baseUrl || process.env.WEATHER_API_BASE_URL || "https://api.open-meteo.com";

  if (!date) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL("/v1/forecast", baseUrl);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_sum,cloud_cover_mean,wind_speed_10m_max"
    );
    url.searchParams.set("start_date", date);
    url.searchParams.set("end_date", date);
    url.searchParams.set("timezone", "auto");

    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      logger("weather forecast fetch failed", { status: response.status });
      return null;
    }

    const payload = await response.json();
    const daily = payload?.daily;
    if (!daily || !daily.time || daily.time.length === 0) {
      logger("weather forecast payload missing daily");
      return null;
    }

    const tempMax = daily.temperature_2m_max?.[0];
    const tempMin = daily.temperature_2m_min?.[0];
    const temperature = Number.isFinite(tempMax) && Number.isFinite(tempMin)
      ? (tempMax + tempMin) / 2
      : null;

    return {
      temperature,
      precipitation: daily.precipitation_sum?.[0] ?? null,
      cloudCover: daily.cloud_cover_mean?.[0] ?? null,
      windSpeed: daily.wind_speed_10m_max?.[0] ?? null
    };
  } catch (error) {
    logger("weather forecast fetch error", { name: error?.name || "unknown" });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
