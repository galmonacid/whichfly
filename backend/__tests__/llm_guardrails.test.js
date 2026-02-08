import test from "node:test";
import assert from "node:assert/strict";
import { runLlmWithGuardrails, buildFallbackResponse, FORMAT_CORRECTION_MESSAGE } from "../llm_guardrails.js";

const allowlist = new Set(["Pheasant Tail Nymph", "Elk Hair Caddis", "Woolly Bugger"]);

function makeValidResponse() {
  return JSON.stringify({
    river: {
      name: "River Wye",
      source: "gps_suggested",
      confidence: "medium",
      distance_m: 12000
    },
    primary: {
      pattern: "Pheasant Tail Nymph",
      type: "nymph",
      size: 16
    },
    alternatives: [
      {
        when: "If you see surface activity",
        pattern: "Elk Hair Caddis",
        type: "dry",
        size: 14
      }
    ],
    explanation: "A reliable nymph covers most UK river trout in mixed conditions.",
    confidence: "medium",
    confidence_reasons: ["Generic river suggestion only"],
    context_used: {
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
      generated_at: "2025-06-01T12:00:00.000Z"
    }
  });
}

function makeAllowlistViolationResponse() {
  return JSON.stringify({
    river: {
      name: "River Wye",
      source: "gps_suggested",
      confidence: "medium",
      distance_m: 12000
    },
    primary: {
      pattern: "MagicMayfly9000",
      type: "dry",
      size: 14
    },
    alternatives: [
      {
        when: "If you see surface activity",
        pattern: "Elk Hair Caddis",
        type: "dry",
        size: 14
      }
    ],
    explanation: "A reliable dry covers most UK river trout in mixed conditions.",
    confidence: "medium",
    confidence_reasons: ["Generic river suggestion only"],
    context_used: {
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
      generated_at: "2025-06-01T12:00:00.000Z"
    }
  });
}

test("runLlmWithGuardrails retries on non-JSON and succeeds", async () => {
  const calls = [];
  const callLlm = async (prompt) => {
    calls.push(prompt);
    return calls.length === 1 ? "not json" : makeValidResponse();
  };

  const result = await runLlmWithGuardrails({
    prompt: "base prompt",
    callLlm,
    allowlist,
    contextUsed: {
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
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.retried, true);
  assert.ok(calls[1].includes(FORMAT_CORRECTION_MESSAGE));
});

test("runLlmWithGuardrails falls back on allowlist violation and logs it", async () => {
  const events = [];
  const callLlm = async () => makeAllowlistViolationResponse();

  const result = await runLlmWithGuardrails({
    prompt: "base prompt",
    callLlm,
    allowlist,
    logger: (event, meta) => events.push({ event, meta }),
    contextUsed: {
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
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.response.primary.pattern, "Pheasant Tail Nymph");
  assert.ok(events.some((entry) => entry.event === "allowlist_violation"));
  assert.ok(events.some((entry) => entry.event === "retry_triggered"));
  assert.ok(events.some((entry) => entry.event === "fallback_used"));
});

test("runLlmWithGuardrails allows non-allowlisted patterns when enforcement is off", async () => {
  const callLlm = async () => makeAllowlistViolationResponse();

  const result = await runLlmWithGuardrails({
    prompt: "base prompt",
    callLlm,
    allowlist,
    enforceAllowlist: false,
    contextUsed: {
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
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.response.primary.pattern, "MagicMayfly9000");
});

test("runLlmWithGuardrails falls back after forbidden phrase", async () => {
  const callLlm = async () => {
    return JSON.stringify({
      river: { name: "River Wye", source: "gps_suggested", confidence: "medium", distance_m: 12000 },
      primary: { pattern: "Pheasant Tail Nymph", type: "nymph", size: 16 },
    alternatives: [],
    explanation: "A hatch is on so fish the lower beat.",
    confidence: "medium",
    confidence_reasons: ["Test"],
    context_used: {
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
    meta: { version: "0.1", mode: "right_now", generated_at: "2025-06-01T12:00:00.000Z" }
  });
};

  const result = await runLlmWithGuardrails({
    prompt: "base prompt",
    callLlm,
    allowlist,
    river: { name: "Unknown", source: "unknown", confidence: "low", distance_m: null },
    contextUsed: {
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
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.response.primary.pattern, "Pheasant Tail Nymph");
  assert.deepEqual(result.response.alternatives, []);
});

test("runLlmWithGuardrails rejects source-like claims", async () => {
  const callLlm = async () => {
    return JSON.stringify({
      river: { name: "River Wye", source: "gps_suggested", confidence: "medium", distance_m: 12000 },
      primary: { pattern: "Pheasant Tail Nymph", type: "nymph", size: 16 },
      alternatives: [],
      explanation: "Anglers report strong rises so dries are a sure bet today.",
      confidence: "medium",
      confidence_reasons: ["Test"],
      context_used: {
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
      meta: { version: "0.1", mode: "right_now", generated_at: "2025-06-01T12:00:00.000Z" }
    });
  };

  const result = await runLlmWithGuardrails({
    prompt: "base prompt",
    callLlm,
    allowlist,
    contextUsed: {
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
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.response.primary.pattern, "Pheasant Tail Nymph");
});

test("buildFallbackResponse returns schema-safe payload", () => {
  const fallback = buildFallbackResponse({
    river: { name: "Unknown", source: "unknown", confidence: "low", distance_m: null },
    generatedAt: "2025-06-01T12:00:00.000Z",
    allowlist: new Set(["Elk Hair Caddis", "Pheasant Tail Nymph"]),
    contextUsed: {
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
    }
  });

  assert.equal(fallback.primary.pattern, "Pheasant Tail Nymph");
  assert.equal(fallback.meta.generated_at, "2025-06-01T12:00:00.000Z");
  assert.deepEqual(fallback.alternatives, []);
});

test("buildFallbackResponse uses allowlist when default not present", () => {
  const fallback = buildFallbackResponse({
    allowlist: new Set(["Elk Hair Caddis"]),
    contextUsed: {
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
    }
  });

  assert.equal(fallback.primary.pattern, "Elk Hair Caddis");
});

test("runLlmWithGuardrails logs validation failures when logger provided", async () => {
  const events = [];
  const callLlm = async () => "not json";

  await runLlmWithGuardrails({
    prompt: "base prompt",
    callLlm,
    allowlist,
    logger: (event, meta) => events.push({ event, meta }),
    contextUsed: {
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
    }
  });

  assert.ok(events.some((entry) => entry.event === "llm_output_invalid_json"));
  assert.ok(events.some((entry) => entry.event === "llm_output_fallback"));
});
