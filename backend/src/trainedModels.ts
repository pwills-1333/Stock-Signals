// backend/src/trainedModels.ts
import type { ModelArtifact, ModelHead } from "./types.ts";

/**
 * Run a single Ridge head
 */
export function runRidgeHead(head: ModelHead, features: number[]): number {
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
 * Run every head in the artifact
 */
export function runAllHeads(
  artifact: ModelArtifact,
  features: number[],
): { name: string; output: number }[] {
  if (!artifact || !Array.isArray(artifact.heads)) return [];

  return artifact.heads.map((head) => ({
    name: head.name ?? "unnamed",
    output: runRidgeHead(head, features),
  }));
}

/**
 * Simple average aggregation + signal generation
 */
export function aggregateHeads(
  results: { name: string; output: number }[],
): {
  expectedReturn: number;
  confidence: number;
  signal: "buy" | "sell" | "neutral";
} {
  if (!Array.isArray(results) || results.length === 0) {
    return {
      expectedReturn: 0,
      confidence: 0,
      signal: "neutral",
    };
  }

  const avg =
    results.reduce((sum, r) => sum + (r.output ?? 0), 0) / results.length;

  // Confidence is magnitude of the average (capped at 1)
  const confidence = Math.min(Math.abs(avg), 1);

  let signal: "buy" | "sell" | "neutral" = "neutral";
  if (avg > 0.015) signal = "buy";
  if (avg < -0.015) signal = "sell";

  return {
    expectedReturn: avg,
    confidence,
    signal,
  };
}
