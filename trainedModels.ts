import { ARTIFACTS_PATH } from "./config.ts";
import { clamp } from "./stats.ts";
import { FEATURE_NAMES, buildFeatureVector } from "./mlFeatures.ts";

let ART: Record<string, unknown> | null = null;
export async function loadModelArtifacts(path = ARTIFACTS_PATH) {
if (ART) return ART;
try {
const text = await Deno.readTextFile(path);
ART = JSON.parse(text);
return ART;
} catch {
ART = null;
return null;
}

}

function ridgePredict(art: { coef: number[]; intercept: number }, x:
number[]) {
let s = art.intercept || 0;
const n = Math.min(art.coef.length, x.length);
for (let i = 0; i < n; i++) s += (art.coef[i] || 0) * x[i];
return clamp(s, -0.5, 0.5);
}

function heuristicHeads(
closes: number[],
features: Record<string, number>,
horizonDays: number,
) {
const n = closes.length;
let sum = 0, c = 0;
for (let i = 1; i < n; i++) {
if (closes[i - 1] > 0) {
sum += Math.log(closes[i] / closes[i - 1]);
c++;
}

}

const meanR = c ? sum / c : 0;
const markov = meanR * horizonDays;
const mom = features.mom20 || 0;
return {
markov: { yhat: clamp(markov, -0.4, 0.4) },
arimaLstm: { yhat: clamp(0.6 * markov + 0.4 * mom, -0.4, 0.4) },
lstm: {
yhat: clamp(
0.5 * mom + 0.5 * (features.sentiment || 0) * 0.02 * horizonDays,
-0.4,
0.4,
),
},
xgb: {
yhat: clamp(
0.4 * mom +
0.3 * ((features.rsi || 0.5) - 0.5) * 0.04 +
0.3 * (features.macdHist || 0),
-0.4,
0.4,
),
},
rf: { yhat: clamp(0.5 * mom + 0.5 * markov, -0.4, 0.4) },
source: "heuristic" as const,
};

}

export function predictTrainedHeads(
featureVec: number[],
closes: number[],
art: Record<string, unknown> | null,
horizonDays: number,
) {
const ridge = art?.ridge_features as { coef: number[]; intercept:
number } | undefined;
const baseHorizon = (art?.horizonDays as number | undefined) ?? 14;
const scale = horizonDays / baseHorizon;
if (ridge?.coef) {
const y = ridgePredict(ridge, featureVec) * scale;
return {
markov: { yhat: y * 0.85 },
arimaLstm: { yhat: y * 1.05 },
lstm: { yhat: y * 0.95 },
xgb: { yhat: y * 1.10 },
rf: { yhat: y * 0.90 },
source: "trained_ridge_v1" as const,
};

}

const featObj: Record<string, number> = {};
FEATURE_NAMES.forEach((name, i) => {
featObj[name] = featureVec[i];
});
return heuristicHeads(closes, featObj, horizonDays);
}

export { buildFeatureVector };
