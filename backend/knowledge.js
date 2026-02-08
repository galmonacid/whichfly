import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snippetsDir = path.resolve(__dirname, "..", "knowledge", "snippets");
const reachesPath = path.resolve(__dirname, "..", "data", "uk_river_reaches.json");
const legacyRiversPath = path.resolve(__dirname, "..", "data", "uk_rivers_min.json");

const CONFIDENCE_RANK = {
  high: 3,
  medium: 2,
  low: 1
};

const KIND_ORDER = [
  "safety_note",
  "river_type_guidance",
  "general_guidance",
  "angler_reports"
];

export function normalizeRiverName(value) {
  if (!value) return "";
  let normalized = String(value).toLowerCase().trim();
  normalized = normalized.replace(/^r\.\s+/i, "river ");
  normalized = normalized.replace(/^r\s+/i, "river ");
  normalized = normalized.replace(/[(),]/g, " ");
  normalized = normalized.replace(/\bthe\b/g, " ");
  normalized = normalized.replace(/\briver\b/g, " ");
  normalized = normalized.replace(/[^a-z0-9]+/g, " ");
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function loadRiverDataset() {
  try {
    return JSON.parse(readFileSync(reachesPath, "utf-8"));
  } catch (error) {
    return JSON.parse(readFileSync(legacyRiversPath, "utf-8"));
  }
}

export function buildRiverIndex(dataset = null) {
  const data = Array.isArray(dataset) ? dataset : loadRiverDataset();
  const riverIds = new Set();
  const byNormalizedName = new Map();

  const addNormalized = (name, riverId) => {
    const normalized = normalizeRiverName(name);
    if (!normalized) return;
    const existing = byNormalizedName.get(normalized) || new Set();
    existing.add(riverId);
    byNormalizedName.set(normalized, existing);
  };

  for (const entry of data) {
    const name = entry?.river_name || entry?.name;
    if (!name) continue;
    const riverId = entry?.river_id || slugify(name);
    riverIds.add(riverId);
    addNormalized(name, riverId);
    if (entry?.river_name_alt) {
      addNormalized(entry.river_name_alt, riverId);
    }
  }

  return { riverIds, byNormalizedName };
}

function sortByConfidenceAndId(a, b) {
  const rankA = CONFIDENCE_RANK[a.confidence] || 0;
  const rankB = CONFIDENCE_RANK[b.confidence] || 0;
  if (rankA !== rankB) {
    return rankB - rankA;
  }
  return String(a.id).localeCompare(String(b.id));
}

function matchesScope(snippet, context) {
  if (!snippet?.scope || snippet.scope.country !== "UK") {
    return false;
  }

  const scope = snippet.scope;
  const riverName = context.riverName || null;
  const riverId = context.riverId || null;
  const riverType = context.riverType || "unknown";
  const season = context.season || "unknown";

  if (scope.river_id) {
    if (!riverId || scope.river_id !== riverId) {
      return false;
    }
  } else if (scope.river) {
    if (!riverName || normalizeRiverName(scope.river) !== normalizeRiverName(riverName)) {
      return false;
    }
  }

  const riverTypes = Array.isArray(scope.river_type) ? scope.river_type : [];
  if (!(riverTypes.includes(riverType) || riverTypes.includes("unknown"))) {
    return false;
  }

  const seasons = Array.isArray(scope.season) ? scope.season : [];
  if (!(seasons.includes(season) || seasons.includes("unknown"))) {
    return false;
  }

  return true;
}

function toRuntimeSnippet(snippet) {
  return {
    id: snippet.id,
    summary: snippet.summary,
    confidence: snippet.confidence,
    tags: Array.isArray(snippet.tags) ? snippet.tags : []
  };
}

export function resolveSnippetScope(snippet, riverIndex) {
  const scope = snippet?.scope || {};
  const compiled = {
    ...snippet,
    scope: {
      ...scope
    }
  };

  if (scope.river_id) {
    if (!riverIndex.riverIds.has(scope.river_id)) {
      throw new Error(`Unknown river_id in snippet ${snippet.id || "unknown"}: ${scope.river_id}`);
    }
    return compiled;
  }

  if (scope.river) {
    const normalized = normalizeRiverName(scope.river);
    const matches = riverIndex.byNormalizedName.get(normalized);
    if (!matches || matches.size === 0) {
      throw new Error(`No river match for snippet ${snippet.id || "unknown"}: ${scope.river}`);
    }
    if (matches.size > 1) {
      throw new Error(
        `Ambiguous river match for snippet ${snippet.id || "unknown"}: ${scope.river}`
      );
    }
    const [riverId] = Array.from(matches);
    compiled.scope.river_id = riverId;
  }

  return compiled;
}

export function compileGroundingSnippets(snippets, riverIndex) {
  const compiled = [];
  for (const snippet of snippets || []) {
    compiled.push(resolveSnippetScope(snippet, riverIndex));
  }
  return compiled;
}

export function loadGroundingSnippets() {
  const riverIndex = buildRiverIndex();
  let files = [];
  try {
    files = readdirSync(snippetsDir);
  } catch (error) {
    return [];
  }

  const snippets = [];
  for (const file of files) {
    if (!file.endsWith(".json") || file === "snippets.schema.json") {
      continue;
    }
    const fullPath = path.join(snippetsDir, file);
    const content = readFileSync(fullPath, "utf-8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      parsed.forEach((snippet) => snippets.push(snippet));
    }
  }

  return compileGroundingSnippets(snippets, riverIndex);
}

export function selectGroundingSnippets(
  snippets,
  context,
  { maxTotal = 4, maxAnglerReports = 1 } = {}
) {
  const matching = (Array.isArray(snippets) ? snippets : [])
    .filter((snippet) => matchesScope(snippet, context))
    .map((snippet) => ({ ...snippet }));

  const byKind = new Map(KIND_ORDER.map((kind) => [kind, []]));
  for (const snippet of matching) {
    if (byKind.has(snippet.kind)) {
      byKind.get(snippet.kind).push(snippet);
    }
  }

  for (const list of byKind.values()) {
    list.sort(sortByConfidenceAndId);
  }

  const selected = [];

  const safetyNotes = byKind.get("safety_note") || [];
  if (safetyNotes.length > 0 && selected.length < maxTotal) {
    selected.push(safetyNotes[0]);
  }

  const riverGuidance = byKind.get("river_type_guidance") || [];
  if (riverGuidance.length > 0 && selected.length < maxTotal) {
    selected.push(riverGuidance[0]);
  }

  const generalGuidance = byKind.get("general_guidance") || [];
  for (const snippet of generalGuidance) {
    if (selected.length >= maxTotal) {
      break;
    }
    selected.push(snippet);
  }

  const anglerReports = byKind.get("angler_reports") || [];
  if (
    anglerReports.length > 0 &&
    selected.length < maxTotal &&
    maxAnglerReports > 0
  ) {
    selected.push(anglerReports[0]);
  }

  const limited = selected.slice(0, maxTotal);
  const cappedReports = [];
  let reportCount = 0;
  for (const snippet of limited) {
    if (snippet.kind === "angler_reports") {
      reportCount += 1;
      if (reportCount > maxAnglerReports) {
        continue;
      }
    }
    cappedReports.push(snippet);
  }

  return cappedReports.map(toRuntimeSnippet);
}
