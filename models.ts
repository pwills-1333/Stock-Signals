import { clamp } from "./stats.ts";
import type { Weights } from "./types.ts";

export function ensembleYhat(
models: Record<string, { yhat?: number } | number>,
weights: Weights,
regime: string,
) {
const keys = ["markov", "arimaLstm", "lstm", "xgb", "rf"] as
const;
let y = 0, wsum = 0;
const vals: number[] = [];
// Defensive renormalization so weights always sum to ~1
const rawW = keys.map((k) => Math.max(0, weights[k] ?? 0.2));
const totalRaw = rawW.reduce((a, b) => a + b, 0) || 1;
const normW = Object.fromEntries(
keys.map((k, i) => [k, rawW[i] / totalRaw]),
) as Weights;
for (const k of keys) {
const raw = models[k];
const v = typeof raw === "number" ? raw : (raw?.yhat ?? 0);
const w = normW[k];
if (Number.isFinite(v)) {
y += w * v;
wsum += w;
vals.push(v);
}

}

if (wsum === 0 || vals.length === 0) {
return { yhat: 0, disagreement: 1, regime };
}

const yhat = y / wsum;
const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
const disagreement =
vals.reduce((a, v) => a + Math.abs(v - mean), 0) / vals.length;
return {
yhat: clamp(yhat, -0.6, 0.6),
disagreement,
regime,
};

}
