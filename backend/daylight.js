const DEFAULT_TIMEOUT_MS = 3000;

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function computeDaylightContext({ now, sunrise, sunset }) {
  const nowDate = toDate(now);
  const sunriseDate = toDate(sunrise);
  const sunsetDate = toDate(sunset);

  if (!nowDate || !sunriseDate || !sunsetDate) {
    return null;
  }

  const isDaylight = nowDate >= sunriseDate && nowDate <= sunsetDate;
  const minutesToSunset = isDaylight
    ? Math.max(0, Math.round((sunsetDate.getTime() - nowDate.getTime()) / 60000))
    : 0;

  return {
    isDaylight,
    minutesToSunset,
    sunriseISO: sunriseDate.toISOString(),
    sunsetISO: sunsetDate.toISOString()
  };
}

export async function fetchDaylight(lat, lon, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const logger = options.logger || (() => {});
  const now = options.now || new Date().toISOString();
  const baseUrl = options.baseUrl || process.env.DAYLIGHT_API_BASE_URL || "https://api.sunrise-sunset.org";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL("/json", baseUrl);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lng", String(lon));
    url.searchParams.set("formatted", "0");

    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      logger("daylight fetch failed", { status: response.status });
      return null;
    }

    const payload = await response.json();
    const results = payload?.results;
    if (!results) {
      logger("daylight payload missing results");
      return null;
    }

    const context = computeDaylightContext({
      now,
      sunrise: results.sunrise,
      sunset: results.sunset
    });

    if (!context) {
      logger("daylight payload invalid");
      return null;
    }

    return context;
  } catch (error) {
    logger("daylight fetch error", { name: error?.name || "unknown" });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
