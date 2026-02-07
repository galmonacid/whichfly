import { validateRightNowResponse } from "./llm_validation.js";

const FORBIDDEN_PHRASES = [
  /hatch is on/i,
  /mayfly hatch/i,
  /hatch happening/i,
  /you'?ll see olives/i,
  /near .* bridge/i,
  /on the .* beat/i,
  /this stretch is known for/i
];

export const FORMAT_CORRECTION_MESSAGE =
  "Your output was invalid. Return JSON ONLY matching the schema. Use ONLY allowlist patterns.";

function hasForbiddenPhrases(explanation) {
  if (typeof explanation !== "string") {
    return false;
  }
  return FORBIDDEN_PHRASES.some((pattern) => pattern.test(explanation));
}

function pickFallbackPattern(allowlist) {
  if (allowlist && allowlist.has("Pheasant Tail Nymph")) {
    return "Pheasant Tail Nymph";
  }
  if (allowlist && allowlist.has("Hare’s Ear Nymph")) {
    return "Hare’s Ear Nymph";
  }
  if (allowlist && allowlist.size > 0) {
    return Array.from(allowlist)[0];
  }
  return "Pheasant Tail Nymph";
}

export function buildFallbackResponse({ river, generatedAt, allowlist, contextUsed } = {}) {
  const safeRiver = river || {
    name: "Unknown",
    source: "unknown",
    confidence: "low",
    distance_m: null
  };

  const pattern = pickFallbackPattern(allowlist);

  return {
    river: safeRiver,
    primary: {
      pattern,
      type: "nymph",
      size: 16
    },
    alternatives: [],
    explanation: "A conservative nymph start that works in many UK river conditions.",
    confidence: "low",
    confidence_reasons: ["Fallback used due to invalid model output"],
    context_used: contextUsed || {
      weather: {
        temperature_c: null,
        precipitation_mm: null,
        cloud_cover_pct: null,
        wind_speed_kph: null
      },
      daylight: {
        is_daylight: null,
        minutes_to_sunset: null
      }
    },
    meta: {
      version: "0.1",
      mode: "right_now",
      generated_at: generatedAt || new Date().toISOString()
    }
  };
}

function validateOutput(candidate, allowlist) {
  const errors = [];

  const validation = validateRightNowResponse(candidate, { allowlist });
  if (!validation.ok) {
    errors.push(...validation.errors);
  }

  if (hasForbiddenPhrases(candidate?.explanation)) {
    errors.push("explanation contains forbidden phrases");
  }

  return { ok: errors.length === 0, errors };
}

export async function runLlmWithGuardrails({
  prompt,
  callLlm,
  allowlist,
  river,
  generatedAt,
  logger,
  contextUsed
}) {
  if (typeof callLlm !== "function") {
    throw new Error("callLlm must be provided");
  }

  const log = typeof logger === "function" ? logger : () => {};

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const requestPrompt = attempt === 0 ? prompt : `${prompt}\n\n${FORMAT_CORRECTION_MESSAGE}`;
    const raw = await callLlm(requestPrompt);

    if (typeof raw !== "string") {
      log("llm_output_not_string", { attempt });
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      log("llm_output_invalid_json", { attempt });
      continue;
    }

    if (!parsed.context_used && contextUsed) {
      parsed.context_used = contextUsed;
    }

    const validation = validateOutput(parsed, allowlist);
    if (validation.ok) {
      return { ok: true, response: parsed, retried: attempt === 1 };
    }

    log("llm_output_failed_validation", { attempt, errors: validation.errors });
  }

  log("llm_output_fallback", { reason: "invalid_or_missing_output" });
  return {
    ok: false,
    response: buildFallbackResponse({ river, generatedAt, allowlist, contextUsed }),
    retried: true
  };
}
