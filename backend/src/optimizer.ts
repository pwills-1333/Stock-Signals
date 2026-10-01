// backend/src/optimizer.ts
import { getOutcomes } from "./store.ts";

/**
 * Placeholder weight adjustment based on recent hit/miss performance.
 * Legacy head names — not used by the Ridge pipeline.
 * Kept for debugging; prefers async store API.
 */
export async function optimizeWeights(): Promise<{
  updated: boolean;
  message: string;
  weights: Record<string, number>;
}> {
  const outcomes = await getOutcomes();

  if (!Array.isArray(outcomes) || outcomes.length < 10) {
    return {
      updated: false,
      message: "Not enough resolved predictions (need at least 10)",
      weights: {},
    };
  }

  const baseWeights: Record<string, number> = {
    markov: 0.15,
    arimaLstm: 0.25,
    lstm: 0.25,
    xgb: 0.20,
    rf: 0.15,
  };

  const hits = outcomes.filter((o) => o.hit);
  const hitRate = hits.length / outcomes.length;
  const adjustment = (hitRate - 0.5) * 0.1;

  const adjusted: Record<string, number> = {};
  for (const [key, value] of Object.entries(baseWeights)) {
    adjusted[key] = Math.max(0.05, Math.min(0.40, value + adjustment));
  }

  const total = Object.values(adjusted).reduce((a, b) => a + b, 0) || 1;
  for (const key of Object.keys(adjusted)) {
    adjusted[key] = adjusted[key] / total;
  }

  return {
    updated: true,
    message: `Adjusted weights based on ${outcomes.length} outcomes (hit rate: ${(hitRate * 100).toFixed(1)}%)`,
    weights: adjusted,
  };
}
