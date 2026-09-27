// backend/src/trainedModels.ts
import type { ModelArtifact, ModelHead } from "./types.ts";

/** Soft map ridge score → ~14d expected return (keeps sign & rank of heads). */
function scoreToExpectedReturn(score: number): number {
  if (!Number.isFinite(score)) return 0;
  // Typical head intercepts ~0.01–0.03; after price-norm, scores stay moderate.
  // tanh keeps extremes from becoming fake ±25% prints.
  return 0.12 * Math.tanh(score / 0.06);
}

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

export function aggregateHeads(
  results: { name: string; output: number }[],
): {
  expectedReturn: number;
  confidence: number;
  signal: "buy" | "sell" | "neutral";
} {
  if (!Array.isArray(results) || results.length === 0) {
    return { expectedReturn: 0, confidence: 0, signal: "neutral" };
  }

  const avgScore =
    results.reduce((sum, r) => sum + (r.output ?? 0), 0) / results.length;

  const expectedReturn = scoreToExpectedReturn(avgScore);

  // Confidence from score strength (same idea as before, not from |return|)
  const confidence = Math.min(1, Math.abs(avgScore) / 0.06);

  let signal: "buy" | "sell" | "neutral" = "neutral";
  if (expectedReturn > 0.01) signal = "buy";
  if (expectedReturn < -0.01) signal = "sell";

  return { expectedReturn, confidence, signal };
}
