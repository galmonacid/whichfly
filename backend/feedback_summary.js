import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const defaultSummaryPath = path.resolve(projectRoot, "data", "feedback_summaries", "latest.json");

export function loadFeedbackSummary(summaryPath) {
  const resolved = summaryPath || defaultSummaryPath;
  if (!existsSync(resolved)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(resolved, "utf-8"));
  } catch (error) {
    return null;
  }
}

export function shouldIncludeAnglerReports(summary, { minTotal = 10, threshold = 0.4 } = {}) {
  if (!summary?.overall || typeof summary.overall.total !== "number") {
    return true;
  }
  if (summary.overall.total < minTotal) {
    return true;
  }
  return summary.overall.success_rate >= threshold;
}

export function adjustConfidenceWithSummary(
  confidence,
  summary,
  { minTotal = 5, threshold = 0.4 } = {}
) {
  if (!summary?.success_rates?.by_confidence || !confidence) {
    return { confidence, adjusted: false };
  }
  const entry = summary.success_rates.by_confidence[confidence];
  if (!entry || typeof entry.total !== "number") {
    return { confidence, adjusted: false };
  }
  if (entry.total < minTotal) {
    return { confidence, adjusted: false };
  }
  if (entry.success_rate < threshold && confidence !== "low") {
    return { confidence: "low", adjusted: true };
  }
  return { confidence, adjusted: false };
}

export function derivePatternBias(summary, { season, region, allowlist } = {}) {
  if (!summary?.top_patterns) {
    return [];
  }
  const bias = [];
  const bySeason = summary.top_patterns.by_season || {};
  const byRegion = summary.top_patterns.by_region || {};

  const addPatterns = (list = []) => {
    for (const entry of list) {
      if (!entry?.pattern) continue;
      bias.push(entry.pattern);
    }
  };

  if (season && bySeason[season]) {
    addPatterns(bySeason[season]);
  }
  if (region && byRegion[region]) {
    addPatterns(byRegion[region]);
  }

  const unique = Array.from(new Set(bias));
  if (allowlist && allowlist.size > 0) {
    return unique.filter((pattern) => allowlist.has(pattern));
  }
  return unique;
}
