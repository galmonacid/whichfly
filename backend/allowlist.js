import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const allowlistPath = path.resolve(__dirname, "..", "docs", "FLY_ALLOWLIST.md");

export function loadFlyAllowlist() {
  const content = readFileSync(allowlistPath, "utf-8");
  const patterns = new Set();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) {
      continue;
    }

    const pattern = trimmed.slice(2).trim();
    if (pattern.length > 0 && !pattern.startsWith("Typical sizes")) {
      patterns.add(pattern);
    }
  }

  return patterns;
}
