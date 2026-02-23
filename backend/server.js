import http from "node:http";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateFeedbackRequest, validateByTheRiversideRequest } from "./contracts.js";
import { fetchWeather, fetchWeatherForecast } from "./weather.js";
import { fetchDaylight } from "./daylight.js";
import { findReachById, findRiverByName, listRiverOptions, suggestRiverWithReach } from "./river_suggestion.js";
import { validateByTheRiversideResponse } from "./llm_validation.js";
import { loadFlyAllowlist } from "./allowlist.js";
import { runLlmWithGuardrails, buildFallbackResponse } from "./llm_guardrails.js";
import { buildRuntimePrompt, callOpenAiResponses, loadPromptSections, loadResponseSchema } from "./llm_client.js";
import { loadEnvLocal } from "./env.js";
import { deriveSeasonFromDate } from "./season.js";
import { loadGroundingSnippets, selectGroundingSnippets } from "./knowledge.js";
import { deriveRegionFromCoords, deriveRiverType } from "./river_type.js";
import {
  adjustConfidenceWithSummary,
  derivePatternBias,
  loadFeedbackSummary,
  shouldIncludeAnglerReports
} from "./feedback_summary.js";

loadEnvLocal();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(projectRoot, "frontend");

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_OPENAI_TIMEOUT_MS = 15000;
const FLY_ALLOWLIST = loadFlyAllowlist();
const GROUNDING_SNIPPETS = loadGroundingSnippets();
const IS_PROD = process.env.NODE_ENV === "production";
const LLM_DEBUG = !IS_PROD && process.env.LLM_DEBUG === "true";
const ALLOWLIST_ENFORCEMENT = process.env.ALLOWLIST_ENFORCEMENT === "true";
const FEEDBACK_STORE_PATH = process.env.FEEDBACK_STORE_PATH || "";
const FEEDBACK_SUMMARY = loadFeedbackSummary(process.env.FEEDBACK_SUMMARY_PATH);
const PROMPT_SECTIONS = loadPromptSections();
const RESPONSE_SCHEMA = loadResponseSchema();
const GUARDRAIL_LOG_EVENTS = new Set([
  "allowlist_violation",
  "pattern_rejected",
  "retry_triggered",
  "fallback_used"
]);

// Placeholder config for future external integrations (not used in MVP).
const WEATHER_API_BASE_URL = process.env.WEATHER_API_BASE_URL || "https://api.open-meteo.com";
const DAYLIGHT_API_BASE_URL = process.env.DAYLIGHT_API_BASE_URL || "https://api.sunrise-sunset.org";
void WEATHER_API_BASE_URL;
void DAYLIGHT_API_BASE_URL;

function getAllowedCorsOrigin(origin) {
  if (!origin) {
    return null;
  }

  if (!IS_PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin;
  }

  return null;
}

function applyApiCors(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = getAllowedCorsOrigin(origin);
  if (!allowedOrigin) {
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  return true;
}

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || "";
}

function getOpenAiModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function getOpenAiTimeoutMs() {
  const raw = Number.parseInt(process.env.OPENAI_TIMEOUT_MS || "", 10);
  if (Number.isFinite(raw) && raw >= 1000) {
    return raw;
  }
  return DEFAULT_OPENAI_TIMEOUT_MS;
}

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
    mode: "by_the_riverside"
  }
};

function logEvent(event, meta = {}) {
  if (IS_PROD) {
    console.log(JSON.stringify({ event, ...meta }));
    return;
  }
  console.log(event, meta);
}

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

async function storeFeedbackEvent(eventPayload) {
  if (!FEEDBACK_STORE_PATH) {
    return;
  }
  try {
    const dir = path.dirname(FEEDBACK_STORE_PATH);
    await mkdir(dir, { recursive: true });
    await appendFile(FEEDBACK_STORE_PATH, `${JSON.stringify(eventPayload)}\n`);
  } catch (error) {
    logEvent("feedback_store_error", { message: error?.message || "unknown" });
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad request");
      return;
    }

    if (req.url.startsWith("/api/")) {
      applyApiCors(req, res);
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
    }

    if (req.url === "/api/recommendation") {
      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }

      try {
        let payload;
        try {
          payload = await readJsonBody(req);
        } catch (error) {
          logEvent("request_invalid_json", { path: req.url });
          json(res, 400, { error: "Invalid JSON" });
          return;
        }
        if (payload === null) {
          json(res, 400, { error: "Invalid request", details: ["Request body is required."] });
          return;
        }

        const validation = validateByTheRiversideRequest(payload);
        if (!validation.ok) {
          logEvent("request_validation_failed", { path: req.url });
          json(res, 400, { error: "Invalid request", details: validation.errors });
          return;
        }

        const mode = validation.mode || "by_the_riverside";
        let river = MOCK_RECOMMENDATION.river;
        let weatherContext = null;
        let daylightContext = null;
        let weatherSource = null;
        let reachForContext = null;

        if (payload.riverReachId) {
          const reachMatch = findReachById(payload.riverReachId);
          if (reachMatch) {
            reachForContext = reachMatch;
            river = {
              name: reachMatch.name,
              confidence: "high",
              source: "user_selected",
              distance_m: null
            };
          }
        }

        if (payload.riverName) {
          river = {
            name: payload.riverName,
            confidence: "high",
            source: "user_selected",
            distance_m: null
          };
          reachForContext = reachForContext || findRiverByName(payload.riverName);
        }

        if (mode === "planning" && payload.riverName) {
          const logger = process.env.NODE_ENV === "production"
            ? () => {}
            : (message, meta = {}) => console.log(message, meta);
          const match = reachForContext || findRiverByName(payload.riverName);
          if (!reachForContext) {
            reachForContext = match;
          }
          if (match) {
            weatherContext = await fetchWeatherForecast(match.lat, match.lon, payload.plannedDate, { logger });
            weatherSource = "forecast";
          }
        }

        if (payload.gps) {
          const logger = process.env.NODE_ENV === "production"
            ? () => {}
            : (message, meta = {}) => console.log(message, meta);
          // Weather is fetched for internal context only; response stays mocked for now.
          if (!payload.riverName) {
            const suggestion = suggestRiverWithReach(payload.gps.lat, payload.gps.lon, {
              accuracyM: payload.gps.accuracy ?? null
            });
            river = suggestion.river;
            reachForContext = suggestion.reach || null;
          }
          const contextCoords = reachForContext
            ? { lat: reachForContext.lat, lon: reachForContext.lon }
            : { lat: payload.gps.lat, lon: payload.gps.lon };
          if (mode !== "planning") {
            weatherContext = await fetchWeather(contextCoords.lat, contextCoords.lon, { logger });
            weatherSource = "current";
            daylightContext = await fetchDaylight(contextCoords.lat, contextCoords.lon, { logger });
          }
          if (LLM_DEBUG) {
            console.log("weather_context", weatherContext);
            console.log("daylight_context", daylightContext);
          }
        }

        const generatedAt = new Date().toISOString();
        let responsePayload = {
          ...MOCK_RECOMMENDATION,
          river,
          meta: {
            ...MOCK_RECOMMENDATION.meta,
            generated_at: generatedAt,
            mode
          }
        };

        const season = deriveSeasonFromDate(mode === "planning" ? payload.plannedDate : undefined);
        const inputs = {
          water_level: payload.waterLevel === "low"
            ? "Low"
            : payload.waterLevel === "high"
              ? "High"
              : payload.waterLevel
                ? "Normal"
                : null,
          planned_date: payload.plannedDate || null,
          season,
          observations: {
            fish_rising: payload.observations?.fishRising ?? null,
            insects_seen: null
          }
        };
        // TODO: Derive region from reach metadata when available.
        const regionFromReach = reachForContext
          ? deriveRegionFromCoords(reachForContext.lat, reachForContext.lon)
          : null;
        const regionFromGps = payload.gps
          ? deriveRegionFromCoords(payload.gps.lat, payload.gps.lon)
          : null;
        const derivedRegion = regionFromReach || regionFromGps;
        const derivedRiverType = deriveRiverType(river?.name || null, derivedRegion);
        const includeAnglerReports = shouldIncludeAnglerReports(FEEDBACK_SUMMARY);
        const snippetContext = {
          riverId: reachForContext?.river_id || null,
          riverName: river?.name || null,
          riverType: derivedRiverType.type,
          season
        };
        const groundingSnippets = selectGroundingSnippets(GROUNDING_SNIPPETS, snippetContext, {
          maxAnglerReports: includeAnglerReports ? 1 : 0
        });
        const patternBias = derivePatternBias(FEEDBACK_SUMMARY, {
          season,
          region: derivedRegion,
          allowlist: FLY_ALLOWLIST
        });

        const contextUsed = {
          weather: weatherContext
            ? {
                temperature_c: weatherContext.temperature,
                precipitation_mm: weatherContext.precipitation,
                cloud_cover_pct: weatherContext.cloudCover,
                wind_speed_kph: weatherContext.windSpeed ?? null
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

        const openAiApiKey = getOpenAiApiKey();
        const openAiTimeoutMs = getOpenAiTimeoutMs();
        if (openAiApiKey) {
          const llmModel = getOpenAiModel();
          if (LLM_DEBUG) {
            console.log("llm_attempt");
          }
          const guardrailLogger = (event, meta = {}) => {
            if (process.env.NODE_ENV === "production") {
              if (!GUARDRAIL_LOG_EVENTS.has(event)) {
                return;
              }
              console.log(JSON.stringify({ event, ...meta }));
              return;
            }
            if (LLM_DEBUG) {
              console.log(event, meta);
            }
          };
          try {
            const runtimePrompt = buildRuntimePrompt({
              river,
              inputs,
              context: contextUsed,
              groundingSnippets,
              mode
            });

            const callLlm = (systemPrompt) =>
              callOpenAiResponses({
                systemPrompt,
                userPrompt: runtimePrompt,
                schema: RESPONSE_SCHEMA,
                model: llmModel,
                apiKey: openAiApiKey,
                timeoutMs: openAiTimeoutMs,
                fetchImpl: fetch,
                logger: LLM_DEBUG ? (event, meta = {}) => console.log(event, meta) : undefined
              });

            const llmResult = await runLlmWithGuardrails({
              prompt: PROMPT_SECTIONS.system,
              callLlm,
              allowlist: FLY_ALLOWLIST,
              river,
              generatedAt,
              logger: guardrailLogger,
              contextUsed,
              mode,
              enforceAllowlist: ALLOWLIST_ENFORCEMENT,
              patternBias
            });

            responsePayload = {
              ...llmResult.response,
              context_used: contextUsed,
              meta: {
                ...llmResult.response.meta,
                mode
              }
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
              contextUsed,
              patternBias
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
            contextUsed,
            patternBias
          });
        }

        const confidenceAdjustment = adjustConfidenceWithSummary(
          responsePayload.confidence,
          FEEDBACK_SUMMARY
        );
        if (confidenceAdjustment.adjusted) {
          responsePayload.confidence = confidenceAdjustment.confidence;
          responsePayload.confidence_reasons = [
            "Conservative adjustment applied",
            ...(responsePayload.confidence_reasons || [])
          ].slice(0, 6);
          logEvent("confidence_adjusted", { mode });
        }

        if (responsePayload.confidence === "low" && responsePayload.primary?.type !== "nymph") {
          responsePayload = buildFallbackResponse({
            river: responsePayload.river,
            generatedAt,
            allowlist: FLY_ALLOWLIST,
            contextUsed,
            patternBias
          });
          responsePayload.confidence_reasons = [
            "Low confidence from model",
            ...responsePayload.confidence_reasons
          ].slice(0, 6);
        }

        responsePayload.meta = {
          ...responsePayload.meta,
          mode
        };

        const outputValidation = validateByTheRiversideResponse(responsePayload, {
          allowlist: ALLOWLIST_ENFORCEMENT ? FLY_ALLOWLIST : null
        });
        if (!outputValidation.ok) {
          logEvent("response_validation_failed", { path: req.url });
          json(res, 500, { error: "Invalid recommendation output", details: outputValidation.errors });
          return;
        }

        json(res, 200, responsePayload);
        return;
      } catch (error) {
        logEvent("request_error", { path: req.url });
        json(res, 500, { error: "Server error" });
        return;
      }
    }

    if (req.url === "/api/rivers") {
      if (req.method !== "GET") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      const options = listRiverOptions();
      json(res, 200, { options });
      return;
    }

    if (req.url === "/api/river-suggestion") {
      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      try {
        let payload;
        try {
          payload = await readJsonBody(req);
        } catch (error) {
          logEvent("request_invalid_json", { path: req.url });
          json(res, 400, { error: "Invalid JSON" });
          return;
        }
        if (!payload || !payload.gps) {
          json(res, 400, { error: "Invalid request", details: ["gps is required."] });
          return;
        }
        const { lat, lon, accuracy } = payload.gps;
        if (
          typeof lat !== "number" ||
          typeof lon !== "number" ||
          Number.isNaN(lat) ||
          Number.isNaN(lon)
        ) {
          json(res, 400, { error: "Invalid request", details: ["gps.lat and gps.lon must be numbers."] });
          return;
        }
        const suggestion = suggestRiverWithReach(lat, lon, { accuracyM: accuracy ?? null });
        json(res, 200, { river: suggestion.river });
        return;
      } catch (error) {
        logEvent("request_error", { path: req.url });
        json(res, 500, { error: "Server error" });
        return;
      }
    }

    if (req.url === "/api/feedback") {
      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      try {
        let payload;
        try {
          payload = await readJsonBody(req);
        } catch (error) {
          logEvent("request_invalid_json", { path: req.url });
          json(res, 400, { error: "Invalid JSON" });
          return;
        }
        if (payload === null) {
          json(res, 400, { error: "Invalid request", details: ["Request body is required."] });
          return;
        }
        const validation = validateFeedbackRequest(payload);
        if (!validation.ok) {
          logEvent("request_validation_failed", { path: req.url });
          json(res, 400, { error: "Invalid request", details: validation.errors });
          return;
        }
        if (IS_PROD) {
          logEvent("feedback_received", { mode: payload.context?.mode || null });
        }

        const feedbackEvent = {
          received_at: new Date().toISOString(),
          outcome: payload.outcome,
          river_name: payload.riverName,
          river_reach_id: payload.riverReachId || null,
          pattern: payload.pattern || null,
          fly_type: payload.flyType || null,
          confidence: payload.context?.confidence || null,
          mode: payload.context?.mode || null,
          planned_date: payload.context?.plannedDate || null,
          water_level: payload.context?.waterLevel || null
        };
        await storeFeedbackEvent(feedbackEvent);

        json(res, 200, { ok: true });
        return;
      } catch (error) {
        logEvent("request_error", { path: req.url });
        json(res, 500, { error: "Server error" });
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
      console.log(`OPENAI_TIMEOUT_MS=${getOpenAiTimeoutMs()}ms`);
    }
  });
}
