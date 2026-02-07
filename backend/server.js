import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRightNowRequest } from "./contracts.js";
import { fetchWeather } from "./weather.js";
import { fetchDaylight } from "./daylight.js";
import { suggestRiver } from "./river_suggestion.js";
import { validateRightNowResponse } from "./llm_validation.js";
import { loadFlyAllowlist } from "./allowlist.js";
import { runLlmWithGuardrails, buildFallbackResponse } from "./llm_guardrails.js";
import { buildRuntimePrompt, callOpenAiResponses, loadPromptSections, loadResponseSchema } from "./llm_client.js";
import { loadEnvLocal } from "./env.js";

loadEnvLocal();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(projectRoot, "frontend");

const PORT = Number(process.env.PORT || 3000);
const FLY_ALLOWLIST = loadFlyAllowlist();
const LLM_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const LLM_DEBUG = process.env.LLM_DEBUG === "true";
const PROMPT_SECTIONS = loadPromptSections();
const RESPONSE_SCHEMA = loadResponseSchema();

// Placeholder config for future external integrations (not used in MVP).
const WEATHER_API_BASE_URL = process.env.WEATHER_API_BASE_URL || "https://api.open-meteo.com";
const DAYLIGHT_API_BASE_URL = process.env.DAYLIGHT_API_BASE_URL || "https://api.sunrise-sunset.org";
void WEATHER_API_BASE_URL;
void DAYLIGHT_API_BASE_URL;

const MOCK_RECOMMENDATION = {
  river: {
    name: "River Wye",
    confidence: "medium",
    source: "gps_suggested",
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
    },
    {
      when: "If water is high or colored",
      pattern: "Woolly Bugger",
      type: "streamer",
      size: 10
    }
  ],
  explanation: "A reliable nymph covers most UK river trout in mixed conditions.",
  confidence: "medium",
  confidence_reasons: [
    "Generic river suggestion only",
    "No hatch evidence reported"
  ],
  meta: {
    version: "0.1",
    mode: "right_now"
  }
};

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  const raw = Buffer.concat(chunks).toString("utf-8");
  if (raw.trim().length === 0) {
    return null;
  }
  return JSON.parse(raw);
}

async function serveStatic(res, filePath) {
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    const contentType = ext === ".css"
      ? "text/css"
      : ext === ".js"
        ? "application/javascript"
        : "text/html";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (error) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad request");
      return;
    }

    if (req.url === "/api/recommendation") {
      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }

      try {
        const payload = await readJsonBody(req);
        if (payload === null) {
          json(res, 400, { error: "Invalid request", details: ["Request body is required."] });
          return;
        }

        const validation = validateRightNowRequest(payload);
        if (!validation.ok) {
          json(res, 400, { error: "Invalid request", details: validation.errors });
          return;
        }

        let river = MOCK_RECOMMENDATION.river;
        let weatherContext = null;
        let daylightContext = null;

        if (payload.riverName) {
          river = {
            name: payload.riverName,
            confidence: "high",
            source: "user_selected",
            distance_m: null
          };
        }

        if (payload.gps) {
          const logger = process.env.NODE_ENV === "production"
            ? () => {}
            : (message, meta = {}) => console.log(message, meta);
          // Weather is fetched for internal context only; response stays mocked for now.
          weatherContext = await fetchWeather(payload.gps.lat, payload.gps.lon, { logger });
          daylightContext = await fetchDaylight(payload.gps.lat, payload.gps.lon, { logger });
          if (LLM_DEBUG) {
            console.log("weather_context", weatherContext);
            console.log("daylight_context", daylightContext);
          }
          if (!payload.riverName) {
            river = suggestRiver(payload.gps.lat, payload.gps.lon, {
              accuracyM: payload.gps.accuracy ?? null
            });
          }
        }

        const generatedAt = new Date().toISOString();
        let responsePayload = {
          ...MOCK_RECOMMENDATION,
          river,
          meta: {
            ...MOCK_RECOMMENDATION.meta,
            generated_at: generatedAt
          }
        };

        const inputs = {
          water_level: payload.waterLevel === "low"
            ? "Low"
            : payload.waterLevel === "high"
              ? "High"
              : "Normal",
          observations: {
            fish_rising: payload.observations?.fishRising ?? null,
            insects_seen: null
          }
        };

        const contextUsed = {
          weather: weatherContext
            ? {
                temperature_c: weatherContext.temperature,
                precipitation_mm: weatherContext.precipitation,
                cloud_cover_pct: weatherContext.cloudCover,
                wind_speed_kph: null
              }
            : {
                temperature_c: null,
                precipitation_mm: null,
                cloud_cover_pct: null,
                wind_speed_kph: null
              },
          daylight: daylightContext
            ? {
                is_daylight: daylightContext.isDaylight,
                minutes_to_sunset: daylightContext.minutesToSunset
              }
            : {
                is_daylight: null,
                minutes_to_sunset: null
              }
        };

        if (OPENAI_API_KEY) {
          if (LLM_DEBUG) {
            console.log("llm_attempt");
          }
          try {
            const runtimePrompt = buildRuntimePrompt({
              river,
              inputs,
              context: contextUsed,
              allowlist: FLY_ALLOWLIST
            });

            const callLlm = (systemPrompt) =>
              callOpenAiResponses({
                systemPrompt,
                userPrompt: runtimePrompt,
                schema: RESPONSE_SCHEMA,
                model: LLM_MODEL,
                apiKey: OPENAI_API_KEY,
                timeoutMs: 8000,
                fetchImpl: fetch,
                logger: LLM_DEBUG ? (event, meta = {}) => console.log(event, meta) : undefined
              });

            const llmResult = await runLlmWithGuardrails({
              prompt: PROMPT_SECTIONS.system,
              callLlm,
              allowlist: FLY_ALLOWLIST,
              river,
              generatedAt,
              logger: LLM_DEBUG ? (event, meta = {}) => console.log(event, meta) : undefined,
              contextUsed
            });

            responsePayload = {
              ...llmResult.response,
              context_used: contextUsed
            };
            if (LLM_DEBUG) {
              console.log("llm_result", { ok: llmResult.ok, retried: llmResult.retried });
            }
          } catch (error) {
            if (LLM_DEBUG) {
              console.log("llm_error", { message: error?.message || "unknown" });
            }
            responsePayload = buildFallbackResponse({
              river,
              generatedAt,
              allowlist: FLY_ALLOWLIST,
              contextUsed
            });
          }
        } else {
          if (LLM_DEBUG) {
            console.log("llm_skipped_no_key");
          }
          responsePayload = buildFallbackResponse({
            river,
            generatedAt,
            allowlist: FLY_ALLOWLIST,
            contextUsed
          });
        }

        if (responsePayload.confidence === "low" && responsePayload.primary?.type !== "nymph") {
          responsePayload = buildFallbackResponse({
            river: responsePayload.river,
            generatedAt,
            allowlist: FLY_ALLOWLIST
          });
          responsePayload.confidence_reasons = [
            "Low confidence from model",
            ...responsePayload.confidence_reasons
          ].slice(0, 6);
        }

        const outputValidation = validateRightNowResponse(responsePayload, {
          allowlist: FLY_ALLOWLIST
        });
        if (!outputValidation.ok) {
          json(res, 500, { error: "Invalid recommendation output", details: outputValidation.errors });
          return;
        }

        json(res, 200, responsePayload);
        return;
      } catch (error) {
        json(res, 400, { error: "Invalid JSON" });
        return;
      }
    }

    if (req.url === "/" || req.url === "/index.html") {
      await serveStatic(res, path.join(frontendDir, "index.html"));
      return;
    }

    if (req.url === "/app.js") {
      await serveStatic(res, path.join(frontendDir, "app.js"));
      return;
    }

    if (req.url === "/styles.css") {
      await serveStatic(res, path.join(frontendDir, "styles.css"));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createServer();
  server.listen(PORT, () => {
    // Intentional: minimal logging for dev only.
    console.log(`whichFly dev server running on http://localhost:${PORT}`);
    if (LLM_DEBUG) {
      console.log("LLM_DEBUG enabled");
    }
  });
}
