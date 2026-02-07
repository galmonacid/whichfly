/**
 * @typedef {Object} RightNowRequest
 * @property {{lat:number, lon:number, accuracy:number=}=} gps
 * @property {string=} riverName
 * @property {{fishRising:(boolean|null)=}=} observations
 * @property {"low"|"normal"|"high"} waterLevel
 */

/**
 * @typedef {Object} FlyChoice
 * @property {string} pattern
 * @property {"dry"|"nymph"|"streamer"|"wet"|"emerger"} type
 * @property {number} size
 */

/**
 * @typedef {Object} RightNowResponse
 * @property {{name:string, source:"gps_suggested"|"user_selected"|"unknown", confidence:"high"|"medium"|"low", distance_m:number|null}} river
 * @property {FlyChoice} primary
 * @property {{when:string, pattern:string, type:"dry"|"nymph"|"streamer"|"wet"|"emerger", size:number}[]} alternatives
 * @property {string} explanation
 * @property {"high"|"medium"|"low"} confidence
 * @property {string[]} confidence_reasons
 * @property {{weather:{temperature_c:number|null, precipitation_mm:number|null, cloud_cover_pct:number|null, wind_speed_kph:number|null}, daylight:{is_daylight:boolean|null, minutes_to_sunset:number|null}}} context_used
 * @property {{version:string, mode:"right_now"|"planning", generated_at:string}} meta
 */

export const rightNowRequestSchema = {
  type: "object",
  required: ["waterLevel"],
  additionalProperties: false,
  properties: {
    gps: {
      type: "object",
      required: ["lat", "lon"],
      additionalProperties: false,
      properties: {
        lat: { type: "number" },
        lon: { type: "number" },
        accuracy: { type: "number" }
      }
    },
    riverName: { type: "string" },
    observations: {
      type: "object",
      required: [],
      additionalProperties: false,
      properties: {
        fishRising: { type: ["boolean", "null"] }
      }
    },
    waterLevel: { type: "string", enum: ["low", "normal", "high"] }
  }
};

export const rightNowResponseSchema = {
  type: "object",
  required: ["river", "primary", "alternatives", "explanation", "confidence", "confidence_reasons", "context_used", "meta"],
  additionalProperties: false,
  properties: {
    river: {
      type: "object",
      required: ["name", "source", "confidence", "distance_m"],
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        source: { type: "string", enum: ["gps_suggested", "user_selected", "unknown"] },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        distance_m: { type: ["number", "null"] }
      }
    },
    primary: {
      type: "object",
      required: ["pattern", "type", "size"],
      additionalProperties: false,
      properties: {
        pattern: { type: "string" },
        type: { type: "string", enum: ["dry", "nymph", "streamer", "wet", "emerger"] },
        size: { type: "number" }
      }
    },
    alternatives: {
      type: "array",
      items: {
        type: "object",
        required: ["when", "pattern", "type", "size"],
        additionalProperties: false,
        properties: {
          when: { type: "string" },
          pattern: { type: "string" },
          type: { type: "string", enum: ["dry", "nymph", "streamer", "wet", "emerger"] },
          size: { type: "number" }
        }
      }
    },
    explanation: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    confidence_reasons: { type: "array", items: { type: "string" } },
    context_used: {
      type: "object",
      required: ["weather", "daylight"],
      additionalProperties: false,
      properties: {
        weather: {
          type: "object",
          required: ["temperature_c", "precipitation_mm", "cloud_cover_pct", "wind_speed_kph"],
          additionalProperties: false,
          properties: {
            temperature_c: { type: ["number", "null"] },
            precipitation_mm: { type: ["number", "null"] },
            cloud_cover_pct: { type: ["number", "null"] },
            wind_speed_kph: { type: ["number", "null"] }
          }
        },
        daylight: {
          type: "object",
          required: ["is_daylight", "minutes_to_sunset"],
          additionalProperties: false,
          properties: {
            is_daylight: { type: ["boolean", "null"] },
            minutes_to_sunset: { type: ["number", "null"] }
          }
        }
      }
    },
    meta: {
      type: "object",
      required: ["version", "mode", "generated_at"],
      additionalProperties: false,
      properties: {
        version: { type: "string" },
        mode: { type: "string", enum: ["right_now", "planning"] },
        generated_at: { type: "string" }
      }
    }
  }
};

export function validateRightNowRequest(payload) {
  const errors = [];

  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["Request body must be an object."] };
  }

  const allowedKeys = new Set(["gps", "riverName", "observations", "waterLevel"]);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown field: ${key}`);
    }
  }

  if (!payload.waterLevel || typeof payload.waterLevel !== "string") {
    errors.push("waterLevel is required.");
  } else if (!rightNowRequestSchema.properties.waterLevel.enum.includes(payload.waterLevel)) {
    errors.push("waterLevel must be low, normal, or high.");
  }

  if (payload.gps !== undefined) {
    if (!payload.gps || typeof payload.gps !== "object") {
      errors.push("gps must be an object with lat and lon.");
    } else {
      const { lat, lon, accuracy, ...rest } = payload.gps;
      if (Object.keys(rest).length > 0) {
        errors.push("gps only allows lat, lon, and accuracy.");
      }
      if (typeof lat !== "number" || typeof lon !== "number") {
        errors.push("gps.lat and gps.lon must be numbers.");
      }
      if (accuracy !== undefined && typeof accuracy !== "number") {
        errors.push("gps.accuracy must be a number.");
      }
    }
  }

  if (payload.riverName !== undefined && typeof payload.riverName !== "string") {
    errors.push("riverName must be a string.");
  }

  if (payload.observations !== undefined) {
    if (!payload.observations || typeof payload.observations !== "object") {
      errors.push("observations must be an object.");
    } else {
      const { fishRising, ...rest } = payload.observations;
      if (Object.keys(rest).length > 0) {
        errors.push("observations only allows fishRising.");
      }
      if (fishRising !== null && fishRising !== undefined && typeof fishRising !== "boolean") {
        errors.push("observations.fishRising must be boolean or null.");
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
