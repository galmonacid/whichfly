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
