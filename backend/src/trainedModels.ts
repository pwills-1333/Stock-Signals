// backend/src/trainedModels.ts
import type { ModelArtifact, ModelHead } from "./types.ts";

/** Typical |14d equity move| ceiling for display / sizing */
const MAX_ABS_RETURN = 0.12;

/**
 * Map unbounded ridge score → expected return in (-MAX, +MAX).
 * Soft linear region near 0; saturates for extreme scores.
 */
function scoreToReturn(score: number): number {
  if (!Number.isFinite(score)) return 0;
  // Soft calibration: score ~0.05 → ~2% return; large scores approach ±12%
  return MAX_ABS_RETURN * Math.tanh(score / 0.08);
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

/**
 * Average head scores, then convert once into expected-return units.
 */
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

  const expectedReturn = scoreToReturn(avgScore);

  // Confidence from how decisive the score is (before return mapping)
  const confidence = Math.min(1, Math.abs(avgScore) / 0.08);

  let signal: "buy" | "sell" | "neutral" = "neutral";
  if (expectedReturn > 0.01) signal = "buy";
  if (expectedReturn < -0.01) signal = "sell";

  return { expectedReturn, confidence, signal };
}
