import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.resolve(__dirname, "..", "index.html");

test("index.html includes by-the-riverside flow", async () => {
  const html = await readFile(indexPath, "utf-8");
  assert.match(html, /By the riverside/i);
  assert.match(html, /Get fly recommendation/i);
  assert.match(html, /Requesting location/i);
  assert.match(html, /Select river/i);
  assert.match(html, /Are fish rising/i);
  assert.match(html, /Show context used/i);
  assert.match(html, /Planning a trip/i);
  assert.match(html, /Get planning fly recommendation/i);
  assert.match(html, /By the riverside inputs/i);
  assert.match(html, /Did it work\?/i);
});
