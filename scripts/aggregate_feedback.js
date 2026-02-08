import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateFeedback } from "../backend/feedback_aggregation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const inputPath = process.env.FEEDBACK_STORE_PATH
  || path.resolve(projectRoot, "data", "feedback_events.jsonl");
const outputDir = process.env.FEEDBACK_SUMMARY_DIR
  || path.resolve(projectRoot, "data", "feedback_summaries");

function parseJsonLines(text) {
  const events = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch (error) {
      // Skip invalid lines.
    }
  }
  return events;
}

async function main() {
  const raw = await readFile(inputPath, "utf-8");
  const events = parseJsonLines(raw);
  const summary = aggregateFeedback(events);

  await mkdir(outputDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const versionedPath = path.join(outputDir, `summary_${stamp}.json`);
  const latestPath = path.join(outputDir, "latest.json");

  const body = JSON.stringify(summary, null, 2);
  await writeFile(versionedPath, body);
  await writeFile(latestPath, body);

  console.log(`Wrote ${versionedPath}`);
  console.log(`Wrote ${latestPath}`);
}

main().catch((error) => {
  console.error("Failed to aggregate feedback:", error?.message || error);
  process.exit(1);
});
