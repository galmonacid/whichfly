/**
 * @typedef {Object} RightNowRequest
 * @property {{lat:number, lon:number, accuracy:number=}=} gps
 * @property {string=} riverName
 * @property {"low"|"normal"|"high"} waterLevel
 */

/**
 * @typedef {Object} FlyChoice
 * @property {string} pattern
 * @property {"dry"|"nymph"|"streamer"} type
 * @property {string} size
 * @property {string=} condition
 */

/**
 * @typedef {Object} RightNowResponse
 * @property {string} riverSuggestion
 * @property {FlyChoice} primaryFly
 * @property {FlyChoice[]} alternatives
 * @property {string} explanation
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
    waterLevel: { type: "string", enum: ["low", "normal", "high"] }
  }
};

export const rightNowResponseSchema = {
  type: "object",
  required: ["riverSuggestion", "primaryFly", "alternatives", "explanation"],
  additionalProperties: false,
  properties: {
    riverSuggestion: { type: "string" },
    primaryFly: {
      type: "object",
      required: ["pattern", "type", "size"],
      additionalProperties: false,
      properties: {
        pattern: { type: "string" },
        type: { type: "string", enum: ["dry", "nymph", "streamer"] },
        size: { type: "string" },
        condition: { type: "string" }
      }
    },
    alternatives: {
      type: "array",
      items: {
        type: "object",
        required: ["pattern", "type", "size"],
        additionalProperties: false,
        properties: {
          pattern: { type: "string" },
          type: { type: "string", enum: ["dry", "nymph", "streamer"] },
          size: { type: "string" },
          condition: { type: "string" }
        }
      }
    },
    explanation: { type: "string" }
  }
};

export function validateRightNowRequest(payload) {
  const errors = [];

  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["Request body must be an object."] };
  }

  const allowedKeys = new Set(["gps", "riverName", "waterLevel"]);
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

  return { ok: errors.length === 0, errors };
}
