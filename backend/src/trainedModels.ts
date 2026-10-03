// backend/src/trainedModels.ts
import type { ModelArtifact, ModelHead } from "./types.ts";

/**
 * Soft map from raw ridge score → expected return.
 * Tuned down after TSLA walk-forward: MAE ~13–15% with old 0.12 scale.
 */
function scoreToExpectedReturn(score: number): number {
  if (!Number.isFinite(score)) return 0;
  // Was 0.12 * tanh(score / 0.06) → bulk ±8–10%.
  // Smaller scale reduces oversized wrong bets.
  return 0.08 * Math.tanh(score / 0.07);
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

  // Confidence from magnitude of the raw score
  const confidence = Math.min(1, Math.abs(avgScore) / 0.08);

  // Raised from ±0.012 → fewer weak buys (TSLA was ~80% buy)
  let signal: "buy" | "sell" | "neutral" = "neutral";
  if (expectedReturn > 0.022) signal = "buy";
  if (expectedReturn < -0.022) signal = "sell";

  return { expectedReturn, confidence, signal };
}
