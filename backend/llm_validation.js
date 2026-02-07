const RIVER_SOURCES = new Set(["gps_suggested", "user_selected", "unknown"]);
const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);
const FLY_TYPES = new Set(["dry", "nymph", "streamer", "wet", "emerger"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(obj, allowedKeys, errors, path) {
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      errors.push(`${path} has unknown field: ${key}`);
    }
  }
}

function validateString(value, path, errors, { min, max } = {}) {
  if (typeof value !== "string") {
    errors.push(`${path} must be a string`);
    return;
  }
  if (min !== undefined && value.length < min) {
    errors.push(`${path} must be at least ${min} characters`);
  }
  if (max !== undefined && value.length > max) {
    errors.push(`${path} must be at most ${max} characters`);
  }
}

function validateEnum(value, path, allowed, errors) {
  if (!allowed.has(value)) {
    errors.push(`${path} must be one of ${Array.from(allowed).join(", ")}`);
  }
}

function validateFlyPick(value, path, errors) {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  const allowedKeys = new Set(["pattern", "type", "size", "when"]);
  hasOnlyKeys(value, allowedKeys, errors, path);

  validateString(value.pattern, `${path}.pattern`, errors, { min: 2, max: 60 });
  validateEnum(value.type, `${path}.type`, FLY_TYPES, errors);

  if (!Number.isInteger(value.size)) {
    errors.push(`${path}.size must be an integer`);
  } else if (value.size < 6 || value.size > 24) {
    errors.push(`${path}.size must be between 6 and 24`);
  }
}

function validateConditionalFlyPick(value, path, errors) {
  validateFlyPick(value, path, errors);
  validateString(value.when, `${path}.when`, errors, { min: 10, max: 120 });
}

function validateRiver(value, errors) {
  if (!isObject(value)) {
    errors.push("river must be an object");
    return;
  }

  const allowedKeys = new Set(["name", "source", "confidence", "distance_m"]);
  hasOnlyKeys(value, allowedKeys, errors, "river");

  validateString(value.name, "river.name", errors, { min: 1, max: 80 });
  validateEnum(value.source, "river.source", RIVER_SOURCES, errors);
  validateEnum(value.confidence, "river.confidence", CONFIDENCE_LEVELS, errors);

  if (value.distance_m === undefined) {
    errors.push("river.distance_m is required");
  } else if (value.distance_m !== null) {
    if (typeof value.distance_m !== "number") {
      errors.push("river.distance_m must be a number or null");
    } else if (value.distance_m < 0 || value.distance_m > 20000) {
      errors.push("river.distance_m must be between 0 and 20000");
    }
  }
}

function validateMeta(value, errors) {
  if (!isObject(value)) {
    errors.push("meta must be an object");
    return;
  }

  const allowedKeys = new Set(["version", "mode", "generated_at"]);
  hasOnlyKeys(value, allowedKeys, errors, "meta");

  validateString(value.version, "meta.version", errors, { min: 1, max: 20 });
  if (value.mode !== "right_now" && value.mode !== "planning") {
    errors.push("meta.mode must be right_now or planning");
  }

  if (value.generated_at === undefined) {
    errors.push("meta.generated_at is required");
  } else {
    const generatedAt = new Date(value.generated_at);
    if (Number.isNaN(generatedAt.getTime())) {
      errors.push("meta.generated_at must be a valid date-time string");
    }
  }
}

function validateAllowlist(payload, allowlist, errors) {
  if (!allowlist || allowlist.size === 0) {
    return;
  }

  if (payload.primary?.pattern && !allowlist.has(payload.primary.pattern)) {
    errors.push(`primary.pattern not in allowlist: ${payload.primary.pattern}`);
  }

  if (Array.isArray(payload.alternatives)) {
    payload.alternatives.forEach((alt, index) => {
      if (alt.pattern && !allowlist.has(alt.pattern)) {
        errors.push(`alternatives[${index}].pattern not in allowlist: ${alt.pattern}`);
      }
    });
  }
}

function validateContextUsed(value, errors) {
  if (!isObject(value)) {
    errors.push("context_used must be an object");
    return;
  }

  const allowedKeys = new Set(["weather", "daylight"]);
  hasOnlyKeys(value, allowedKeys, errors, "context_used");

  if (!isObject(value.weather)) {
    errors.push("context_used.weather must be an object");
  } else {
    const weatherKeys = new Set([
      "temperature_c",
      "precipitation_mm",
      "cloud_cover_pct",
      "wind_speed_kph"
    ]);
    hasOnlyKeys(value.weather, weatherKeys, errors, "context_used.weather");
    for (const key of weatherKeys) {
      if (!(key in value.weather)) {
        errors.push(`context_used.weather.${key} is required`);
      }
      const weatherValue = value.weather[key];
      if (weatherValue !== null && typeof weatherValue !== "number") {
        errors.push(`context_used.weather.${key} must be a number or null`);
      }
    }
  }

  if (!isObject(value.daylight)) {
    errors.push("context_used.daylight must be an object");
  } else {
    const daylightKeys = new Set(["is_daylight", "minutes_to_sunset"]);
    hasOnlyKeys(value.daylight, daylightKeys, errors, "context_used.daylight");
    if (!("is_daylight" in value.daylight)) {
      errors.push("context_used.daylight.is_daylight is required");
    } else if (value.daylight.is_daylight !== null && typeof value.daylight.is_daylight !== "boolean") {
      errors.push("context_used.daylight.is_daylight must be boolean or null");
    }
    if (!("minutes_to_sunset" in value.daylight)) {
      errors.push("context_used.daylight.minutes_to_sunset is required");
    } else if (value.daylight.minutes_to_sunset !== null && typeof value.daylight.minutes_to_sunset !== "number") {
      errors.push("context_used.daylight.minutes_to_sunset must be a number or null");
    }
  }
}

export function validateRightNowResponse(payload, options = {}) {
  const errors = [];
  const allowlist = options.allowlist || null;

  if (!isObject(payload)) {
    return { ok: false, errors: ["response must be an object"] };
  }

  const allowedKeys = new Set([
    "river",
    "primary",
    "alternatives",
    "explanation",
    "confidence",
    "confidence_reasons",
    "context_used",
    "meta"
  ]);
  hasOnlyKeys(payload, allowedKeys, errors, "response");

  for (const key of allowedKeys) {
    if (!(key in payload)) {
      errors.push(`response.${key} is required`);
    }
  }

  if (payload.river) {
    validateRiver(payload.river, errors);
  }

  if (payload.primary) {
    validateFlyPick(payload.primary, "primary", errors);
  }

  if (payload.alternatives !== undefined) {
    if (!Array.isArray(payload.alternatives)) {
      errors.push("alternatives must be an array");
    } else {
      if (payload.alternatives.length > 2) {
        errors.push("alternatives must have at most 2 items");
      }
      payload.alternatives.forEach((item, index) => {
        validateConditionalFlyPick(item, `alternatives[${index}]`, errors);
      });
    }
  }

  if (payload.explanation !== undefined) {
    validateString(payload.explanation, "explanation", errors, { min: 20, max: 360 });
  }

  if (payload.confidence !== undefined) {
    validateEnum(payload.confidence, "confidence", CONFIDENCE_LEVELS, errors);
  }

  if (payload.confidence_reasons !== undefined) {
    if (!Array.isArray(payload.confidence_reasons)) {
      errors.push("confidence_reasons must be an array");
    } else {
      if (payload.confidence_reasons.length < 1 || payload.confidence_reasons.length > 6) {
        errors.push("confidence_reasons must have 1 to 6 items");
      }
      payload.confidence_reasons.forEach((reason, index) => {
        validateString(reason, `confidence_reasons[${index}]`, errors, { min: 3, max: 120 });
      });
    }
  }

  if (payload.meta) {
    validateMeta(payload.meta, errors);
  }

  if (payload.context_used) {
    validateContextUsed(payload.context_used, errors);
  } else {
    errors.push("context_used is required");
  }

  validateAllowlist(payload, allowlist, errors);

  return { ok: errors.length === 0, errors };
}
