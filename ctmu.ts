import { clamp, logReturns, autocorrelation } from "./stats.ts";
import { updateAdaptivePsiOn, type PsiState } from "./adaptivePsi.ts";
import type { Regime } from "./types.ts";

export function classifyMarketRegime(
hurst: number,
hurstConfidence: number,
closes: number[],
momentum: number,
): Regime {
const r = logReturns(closes);
const ac1 = autocorrelation(r, 1);
const ac5 = autocorrelation(r, 5);
const drift = Math.abs(momentum);
if (hurstConfidence >= 0.4) {
if (hurst >= 0.62) return "trend";
if (hurst <= 0.38) return "meanReversion";
}

if (hurstConfidence >= 0.25) {
if (hurst >= 0.58) return "trend";
if (hurst <= 0.42) return "meanReversion";
}

if (ac1 >= 0.20 || ac5 >= 0.20) return "trend";
if (ac1 <= -0.12) return "meanReversion";
if (drift >= 0.04) return momentum > 0 ? "trend" :
"meanReversion";
if (drift >= 0.02 && hurst >= 0.55) return "trend";
if (drift >= 0.02 && hurst <= 0.45) return "meanReversion";
return "chaos";
}

export function computeAdaptivePsychAndBayes(params: {
sentiment: number;
intensity: number;
momentum: number;
structuralSignal?: number;
newsCount?: number;
shock?: boolean;
thinkingStyle?: number;
prevPrediction?: number;
psiState: PsiState;
}) {
const T = params.thinkingStyle ?? 0.5;
const C =
clamp(
1 / (1 + params.intensity * (Math.abs(params.sentiment) < 0.1 ? 1 :
0.3)) - 0.3,
-1,
1,
) * Math.sign(params.sentiment || 0.01);
const adaptive = updateAdaptivePsiOn(params.psiState, {
S: params.sentiment,
E: params.intensity,
C,
M: params.momentum,
T,
structuralSignal: params.structuralSignal,
prevPrediction: params.prevPrediction,
});
const prior = 0.5;
const likelihood = clamp(0.5 + 0.5 * adaptive.psiTotal, 0, 1);
const evidence = clamp(
1 + 0.3 * (params.newsCount ?? 0) + (params.shock ? 1 : 0),
1,
4,
);

const posterior = clamp((prior * evidence + likelihood) / (evidence +
1), 0, 1);
const posteriorPsi = clamp(
posterior + 0.25 * adaptive.psiTotal - 0.2 *
Math.abs(adaptive.psiTotal),
0,
1,
);

return {
psiScalar: adaptive.psiTotal,
posteriorPsi,
prior,
likelihood,
evidence,
posterior,
factors: {
s: params.sentiment,
e: params.intensity,
c: C,
m: params.momentum,
t: T,
},
adaptiveWeights: adaptive.weights,
weightUncertainty: adaptive.weightUncertainty,
coherence: adaptive.coherence,
error: adaptive.error,
};

}

export function ctmuScores(
ensemble: { yhat: number; disagreement: number },
psi: { scalar: number },
regime: Regime,
shock: boolean,
) {
const yhatSign = Math.sign(ensemble.yhat) || 1;
const neutralPsi = Math.abs(psi.scalar) < 0.05;
const agree = neutralPsi || Math.sign(psi.scalar) === yhatSign;
const strength = Math.tanh(Math.abs(ensemble.yhat) / 0.08);
const telic = agree
? clamp(0.40 + 0.60 * strength, 0, 1)
: clamp(0.25 + 0.50 * strength, 0, 1);
const hology = clamp(1 - (ensemble.disagreement || 0), 0, 1);
const psiConflict = !neutralPsi && Math.sign(psi.scalar) !== yhatSign ?
1 : 0;
const dissonance = clamp(
0.45 * psiConflict + (shock ? 0.25 : 0) + (regime === "chaos" ? 0.10
: 0),
0,
1,
);

const mode =
regime === "trend" ? "momentum" : regime === "meanReversion" ?
"reversion" : "adaptive";
return { telic, hology, dissonance, mode };
}

export function ctmuValid(
scores: { telic: number; hology: number; dissonance: number },
settings: { minTelic?: number; minHology?: number; maxDissonance?:
number },
) {
return (
scores.telic >= (settings.minTelic ?? 0.35) &&
scores.hology >= (settings.minHology ?? 0.4) &&
scores.dissonance <= (settings.maxDissonance ?? 0.5)
);

}

export function superGate(ctx: {
expectedReturn: number;
confidence: number;
quality: number;
ctmuScores: { telic: number; hology: number; dissonance: number };
valid: boolean;
minReturn: number;
minConfidence?: number;
minQuality?: number;
}) {
const minConfidence = ctx.minConfidence ?? 0.4;
const minQuality = ctx.minQuality ?? 0.4;
const ok =
Math.abs(ctx.expectedReturn) >= ctx.minReturn &&
ctx.confidence >= minConfidence &&
ctx.quality >= minQuality &&
ctx.valid;
if (!ok) return { signal: "AVOID" as const, grade: "F" as const };
const returnScore = clamp(
Math.abs(ctx.expectedReturn) / (3 * Math.max(ctx.minReturn, 1e-6)),
0,
1,
);

const ctmuAvg = (ctx.ctmuScores.telic + ctx.ctmuScores.hology) / 2;
const score = clamp(
0.40 * returnScore +
0.25 * ctx.confidence +
0.20 * ctx.quality +
0.15 * ctmuAvg -
0.10 * ctx.ctmuScores.dissonance,
0,
1,
);

let grade: "A" | "B" | "C" | "D" = "D";
if (score >= 0.78) grade = "A";
else if (score >= 0.60) grade = "B";
else if (score >= 0.42) grade = "C";
return {
signal: (ctx.expectedReturn > 0 ? "BUY" : "SELL") as "BUY" |
"SELL",
grade,
};

}

export function kellyFraction(
expectedReturn: number,
garchSigma: number,
confidence: number,
telic: number,
hology: number,
maxDrawdownPct: number,
) {
const edge = clamp(expectedReturn * (0.5 + confidence), -0.2, 0.3);
const varAdj = clamp(0.02 / (garchSigma * Math.sqrt(252) + 0.01), 0.2,
2);
let k = 2 * edge * varAdj * clamp(telic * hology + 0.3, 0.2, 1.5);
return clamp(clamp(k, 0, 0.5), 0, maxDrawdownPct);
}
