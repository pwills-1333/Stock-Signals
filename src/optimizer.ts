import { getOutcomes } from "./store.ts";

export async function optimizeWeights(): Promise<{
  updated: boolean;
  weights: Record<string, number>;
}> {
  const outcomes = getOutcomes();

  if (!Array.isArray(outcomes) || outcomes.length < 5) {
    return {
      updated: false,
      weights: {}
    };
  }

  const featureNames = [
    "markov",
    "arimaLstm",
    "lstm",
    "xgb",
    "rf"
  ];

  const baseWeights: Record<string, number> = {
    markov: 0.15,
    arimaLstm: 0.28,
    lstm: 0.22,
    xgb: 0.20,
    rf: 0.15
  };

  const hits = outcomes.filter((o) => o.hit);
  const misses = outcomes.filter((o) => !o.hit);

  const score = (arr: any[]) =>
    arr.reduce((a, r) => a + Math.abs(r.expectedReturn ?? 0), 0) /
    (arr.length || 1);

  const hitScore = score(hits);
  const missScore = score(misses);

  const delta = hitScore - missScore;

  const adjusted: Record<string, number> = {};
  for (const f of featureNames) {
    const v = baseWeights[f];
    const newV = v + delta * 0.1;
    adjusted[f] = Math.max(0.05, Math.min(0.45, newV));
  }

  const total = Object.values(adjusted).reduce((a, b) => a + b, 0) || 1;
  for (const f of featureNames) {
    adjusted[f] = adjusted[f] / total;
  }

  return {
    updated: true,
    weights: adjusted
  };
}
