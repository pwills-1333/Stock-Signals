import { loadAllArtifacts } from "./artifacts/multiArtifacts.ts";

// We no longer use ARTIFACTS_PATH or single-file loading.
// This cached object will store ALL heads from ALL JSON files.
let cached: any = null;

/**
 * Load ALL model artifacts from /src/artifacts
 * This replaces loadModelArtifacts()
 */
export async function loadModelArtifacts() {
  if (cached) return cached;

  try {
    const artifact = await loadAllArtifacts("src/artifacts");

    if (!artifact || !Array.isArray(artifact.heads)) {
      console.error("Invalid multi-artifact format:", artifact);
      cached = null;
      return null;
    }

    cached = artifact;
    console.log("Loaded ALL trained heads from /src/artifacts");
    return cached;

  } catch (err) {
    console.log("Failed to load multi-artifacts:", err);
    cached = null;
    return null;
  }
}

/**
 * Predict using a single head
 */
export function predictWithArtifact(head: any, features: number[]): number {
  if (!head || !Array.isArray(head.coef) || !Number.isFinite(head.intercept)) {
    return 0;
  }

  let y = head.intercept;

  const len = Math.min(head.coef.length, features.length);
  for (let i = 0; i < len; i++) {
    const c = head.coef[i];
    const f = features[i];
    if (Number.isFinite(c) && Number.isFinite(f)) {
      y += c * f;
    }
  }

  return Number.isFinite(y) ? y : 0;
}

/**
 * Run ALL heads (from ALL JSON files)
 */
export function runAllHeads(artifact: any, features: number[]) {
  if (!artifact || !Array.isArray(artifact.heads)) return [];

  const results = [];

  for (const head of artifact.heads) {
    const output = predictWithArtifact(head, features);
    results.push({
      name: head.name ?? "unnamed",
      output
    });
  }

  return results;
}

/**
 * Aggregate all head outputs into a single signal
 */
export function aggregateHeads(results: any[]) {
  if (!Array.isArray(results) || results.length === 0) {
    return {
      expectedReturn: 0,
      confidence: 0,
      signal: "neutral"
    };
  }

  const avg =
    results.reduce((sum, r) => sum + (r.output ?? 0), 0) / results.length;

  const confidence = Math.min(Math.abs(avg), 1);

  let signal = "neutral";
  if (avg > 0.02) signal = "buy";
  if (avg < -0.02) signal = "sell";

  return {
    expectedReturn: avg,
    confidence,
    signal
  };
}
