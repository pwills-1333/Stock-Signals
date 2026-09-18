import { Prediction } from "./types.ts";

export function computeKelly(modelOutput: any): number {
  if (!modelOutput || !Number.isFinite(modelOutput.expectedReturn)) {
    return 0;
  }

  const r = modelOutput.expectedReturn;
  const p = Math.min(Math.max((r + 1) / 2, 0), 1);
  const q = 1 - p;

  const kelly = p - q;
  return Number.isFinite(kelly) ? Math.max(Math.min(kelly, 1), -1) : 0;
}

export function optimizeWeights(records: Prediction[]) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      markov: 0.15,
      arimaLstm: 0.28,
      lstm: 0.22,
      xgb: 0.20,
      rf: 0.15
    };
  }

  const hits = records.filter((r) => r.resolved && r.hit);
  const misses = records.filter((r) => r.resolved && !r.hit);

  const score = (arr: Prediction[]) =>
    arr.reduce((a, r) => a + Math.abs(r.expectedReturn || 0), 0) /
    (arr.length || 1);

  const hitScore = score(hits);
  const missScore = score(misses);

  const base = {
    markov: 0.15,
    arimaLstm: 0.28,
    lstm: 0.22,
    xgb: 0.20,
    rf: 0.15
  };

  const adj = (v: number) => {
    const s = hitScore - missScore;
    const out = v + s * 0.1;
    return Math.max(0.05, Math.min(out, 0.45));
  };

  const updated = {
    markov: adj(base.markov),
    arimaLstm: adj(base.arimaLstm),
    lstm: adj(base.lstm),
    xgb: adj(base.xgb),
    rf: adj(base.rf)
  };

  const total = Object.values(updated).reduce((a, b) => a + b, 0) || 1;

  for (const k of Object.keys(updated)) {
    updated[k] = updated[k] / total;
  }

  return updated;
}
