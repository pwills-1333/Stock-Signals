import { clamp } from "./stats.ts";
import { DEFAULT_WEIGHTS } from "./config.ts";
import { listAccuracy, listPredictions, saveWeights } from

"./store.ts";
import type { Weights } from "./types.ts";

export async function optimizeModels() {
const resolved = await listAccuracy();
if (resolved.length < 5) {
return { updated: false, reason: "Need ≥5 accuracy records", weights:
DEFAULT_WEIGHTS };
}

const preds = await listPredictions();
const byId = new Map(preds.filter((p) => p.id).map((p) => [p.id!,
p]));
const modelKeys = ["markov", "arimaLstm", "lstm", "xgb",
"rf"] as const;
const score: Record<string, number> = {
markov: 0,
arimaLstm: 0,
lstm: 0,
xgb: 0,
rf: 0,
};

let matched = 0;
for (const r of resolved) {
const p = byId.get(r.predictionId);
if (!p?.ensemble || !r.actualPrice || !r.entryPrice) continue;
const actualReturn = (r.actualPrice - r.entryPrice) / r.entryPrice;
const actualSign = Math.sign(actualReturn) || 0;
if (!actualSign) continue;
matched++;
for (const k of modelKeys) {
const cell = (p.ensemble as Record<string, { yhat?: number } |
number>)[k];
const mVal = Number(typeof cell === "number" ? cell : cell?.yhat);
if (!Number.isFinite(mVal) || mVal === 0) continue;
score[k] += (Math.sign(mVal) === actualSign ? 1 : -1) *
Math.min(Math.abs(actualReturn), 0.4);
}

}

if (!matched) {
return { updated: false, reason: "No prediction matches", weights:
DEFAULT_WEIGHTS };
}

const lo = Math.min(...modelKeys.map((k) => score[k]));
const shift = Math.max(0, -lo) + 0.05;
const positive: Record<string, number> = {};
for (const k of modelKeys) positive[k] = Math.max(0.02, score[k] +
shift);
const total = modelKeys.reduce((a, k) => a + positive[k], 0) || 1;
const weights = {} as Weights;
for (const k of modelKeys) weights[k] = +clamp(positive[k] / total,
0.05, 0.45).toFixed(3);
const sum = modelKeys.reduce((a, k) => a + weights[k], 0) || 1;
for (const k of modelKeys) weights[k] = +(weights[k] /
sum).toFixed(3);
await saveWeights(weights);
return { updated: true, weights, samples: matched };
}
