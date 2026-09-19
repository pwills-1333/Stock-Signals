import { loadAllArtifacts } from "./artifacts/multiArtifacts.ts";

let cached: any = null;

/**
 * Load ALL model artifacts from /src/artifacts
 */
export async function getArtifacts() {
  if (cached) return cached;

  try {
    const artifact = await loadAllArtifacts("src/artifacts");

    if (!artifact || !Array.isArray(artifact.heads)) {
      console.error("Invalid multi-artifact format:", artifact);
      cached = null;
      return null;
    }

    cached = artifact;
    return cached;

  } catch (err) {
    console.error("Failed to load multi-artifacts:", err);
    cached = null;
    return null;
  }
}

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
