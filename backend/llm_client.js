import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const promptPath = path.resolve(projectRoot, "docs", "LLM_AGENT_PROMPT.md");
const schemaPath = path.resolve(projectRoot, "contracts", "right_now.schema.json");

export function loadPromptSections() {
  const content = readFileSync(promptPath, "utf-8");
  const systemMarker = "## System / Instruction Prompt";
  const userMarker = "## User / Runtime Prompt Template";

  const systemIndex = content.indexOf(systemMarker);
  const userIndex = content.indexOf(userMarker);

  if (systemIndex === -1 || userIndex === -1 || userIndex <= systemIndex) {
    return {
      system: content.trim(),
      userTemplate: ""
    };
  }

  const systemSection = content.slice(systemIndex + systemMarker.length, userIndex).trim();
  const userSection = content.slice(userIndex + userMarker.length).trim();

  return {
    system: systemSection,
    userTemplate: userSection
  };
}

export function loadResponseSchema() {
  const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
  return schema;
}

export function buildRuntimePrompt({ river, inputs, context, allowlist }) {
  return {
    mode: "right_now",
    river,
    inputs,
    context,
    allowlist: {
      patterns: Array.from(allowlist)
    }
  };
}

function extractOutputText(responsePayload) {
  const output = responsePayload?.output;
  if (!Array.isArray(output)) {
    return "";
  }

  for (const item of output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }
    const textParts = item.content
      .filter((content) => content.type === "output_text" && typeof content.text === "string")
      .map((content) => content.text);
    if (textParts.length > 0) {
      return textParts.join("");
    }
  }

  return "";
}

export async function callOpenAiResponses({
  systemPrompt,
  userPrompt,
  schema,
  model,
  apiKey,
  timeoutMs = 8000,
  fetchImpl = fetch,
  logger
}) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPrompt) }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "right_now_response",
            strict: true,
            schema
          }
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      if (typeof logger === "function") {
        let bodyText = "";
        try {
          bodyText = await response.text();
        } catch (error) {
          bodyText = "";
        }
        logger("openai_error", { status: response.status, body: bodyText });
      }
      throw new Error(`OpenAI response error: ${response.status}`);
    }

    const payload = await response.json();
    return extractOutputText(payload);
  } finally {
    clearTimeout(timeoutId);
  }
}
