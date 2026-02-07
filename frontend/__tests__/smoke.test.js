import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.resolve(__dirname, "..", "index.html");

test("index.html includes Right now flow", async () => {
  const html = await readFile(indexPath, "utf-8");
  assert.match(html, /Right now/i);
  assert.match(html, /Get recommendation/i);
  assert.match(html, /Requesting location/i);
  assert.match(html, /Select river/i);
});
