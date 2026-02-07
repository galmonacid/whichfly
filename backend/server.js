import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRightNowRequest } from "./contracts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(projectRoot, "frontend");

const PORT = Number(process.env.PORT || 3000);

// Placeholder config for future external integrations (not used in MVP).
const WEATHER_API_BASE_URL = process.env.WEATHER_API_BASE_URL || "https://api.open-meteo.com";
const DAYLIGHT_API_BASE_URL = process.env.DAYLIGHT_API_BASE_URL || "https://api.sunrise-sunset.org";
void WEATHER_API_BASE_URL;
void DAYLIGHT_API_BASE_URL;

const MOCK_RECOMMENDATION = {
  riverSuggestion: "River Wye (suggested)",
  primaryFly: {
    pattern: "Pheasant Tail",
    type: "nymph",
    size: "14"
  },
  alternatives: [
    {
      pattern: "Parachute Adams",
      type: "dry",
      size: "16",
      condition: "If you see surface activity"
    },
    {
      pattern: "Woolly Bugger",
      type: "streamer",
      size: "10",
      condition: "If water is high or colored"
    }
  ],
  explanation: "A general nymph covers most UK river trout in mixed conditions."
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
        const validation = validateRightNowRequest(payload);
        if (!validation.ok) {
          json(res, 400, { error: "Invalid request", details: validation.errors });
          return;
        }

        json(res, 200, MOCK_RECOMMENDATION);
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
  });
}
