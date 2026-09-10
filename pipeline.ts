import { DEFAULT_SETTINGS, DEFAULT_WEIGHTS } from "./config.ts";
import { fetchYahooOHLC, fetchYahooNews, scoreSentiment, detectShock }

from "./data/yahoo.ts";
import {

fetchFinnhubOHLC,
fetchQuote,
fetchCompanyNews,
computeTechnicals,
computeGARCH,
hestonMonteCarlo,
} from "./data/finnhub.ts";
import { ensembleYhat } from "./models.ts";
import {

computeAdaptivePsychAndBayes,
classifyMarketRegime,
ctmuScores,
ctmuValid,
superGate,
kellyFraction,
} from "./ctmu.ts";
import { createPsiSession } from "./adaptivePsi.ts";
import {

computeFractalFeatures,
fractalModelHead,
getRegimeWeights,
computeCTMUFractal,
} from "./fractal.ts";
import { computeHurst, sma, clamp } from "./stats.ts";
import { loadModelArtifacts, predictTrainedHeads, buildFeatureVector }

from "./trainedModels.ts";
import { getSettings, getWeights, savePrediction } from "./store.ts";
import type { Prediction, Settings, Weights } from "./types.ts";

function meanLogReturn(closes: number[]) {
let sum = 0, n = 0;
for (let i = 1; i < closes.length; i++) {
if (closes[i - 1] > 0) {
sum += Math.log(closes[i] / closes[i - 1]);
n++;
}

}

return n ? sum / n : 0;
}

function getHestonParams(regime: string) {
if (regime === "trend") return { kappa: 4, thetaScale: 1.0, xi: 0.5,
rho: -0.4 };
if (regime === "meanReversion") return { kappa: 6, thetaScale: 0.9,
xi: 0.4, rho: -0.3 };
return { kappa: 5, thetaScale: 1.1, xi: 0.7, rho: -0.5 };
}

function tradingDayHorizonEnd(horizonDays: number) {
const end = new Date(Date.now() + horizonDays * 86400 * 1000);
end.setUTCHours(21, 0, 0, 0);
return end.toISOString();
}

export function templateRationale(ctx: {
ticker: string;
signal: string;
regime: string;
expectedReturn: number;
psi: number;
}) {
return `${ctx.signal} on ${ctx.ticker}: ${ctx.regime} regime with Ψ
${ctx.psi.toFixed(2)} and expected return ${(ctx.expectedReturn *
100).toFixed(1)}%.`;
}

export async function fetchInputData(ticker: string) {
const [fhShort, yhShort, yhLong, fhNews, yhNews, quote] = await
Promise.all([
fetchFinnhubOHLC(ticker, 180).catch(() => null),
fetchYahooOHLC(ticker, 180).catch(() => null),
fetchYahooOHLC(ticker, 730).catch(() => null),
fetchCompanyNews(ticker, 7).catch(() => []),
fetchYahooNews(ticker, 20).catch(() => []),
fetchQuote(ticker).catch(() => null),
]);
let ohlc = fhShort && fhShort.c.length >= 30 ? fhShort : yhShort;
if (!ohlc || ohlc.c.length < 20) {
throw new Error(`No usable OHLC data for ${ticker}`);
}

const ohlcLong = yhLong && yhLong.c.length > ohlc.c.length ? yhLong :
ohlc;
const news = (fhNews?.length ? fhNews : []).concat(yhNews ||
[]).slice(0, 16);
return { ohlc, ohlcLong, news, quote };
}

export function computeEngine(
ticker: string,
ohlc: { c: number[]; h: number[]; l: number[]; v: number[] },
news: { title?: string; summary?: string }[],
horizonDays: number,
weights: Weights,
settings: Settings,
ctx: {
ohlcLong?: { c: number[] };
quote?: { price: number } | null;
psiState: ReturnType<typeof createPsiSession>["state"];
modelArtifacts: Record<string, unknown> | null;
},
) {
const s = { ...DEFAULT_SETTINGS, ...settings };
const w = weights || DEFAULT_WEIGHTS;
const tech = computeTechnicals(ohlc);
const closes = ohlc.c;
let S0 = tech.lastClose;
if (ctx.quote && typeof ctx.quote.price === "number" &&
ctx.quote.price > 0) {
const discrepancyPct = ((ctx.quote.price - S0) / S0) * 100;
if (Math.abs(discrepancyPct) < 3) S0 = ctx.quote.price;
}

const sentiment = scoreSentiment(news);
const volumeRatio = tech.avgVolume ? tech.lastVolume / tech.avgVolume :
1;
const shock = detectShock(sentiment, volumeRatio);
const calibrationCloses =
ctx.ohlcLong?.c && ctx.ohlcLong.c.length >= closes.length ?
ctx.ohlcLong.c : closes;
const garch = computeGARCH(calibrationCloses);
const hurstResult = computeHurst(calibrationCloses);
const hurst = hurstResult.value;
const momentum = clamp(
(closes[closes.length - 1] - sma(closes, 20)) / (sma(closes, 20) ||
1),
-1,
1,
);

const regime = classifyMarketRegime(hurst, hurstResult.confidence,
calibrationCloses, momentum);
const recentReturn = closes.length >= 21
? (closes[closes.length - 1] - closes[closes.length - 21]) /
closes[closes.length - 21]
: meanLogReturn(closes) * 20;
const psychResult = computeAdaptivePsychAndBayes({
sentiment: sentiment.S,
intensity: sentiment.E,
momentum,
structuralSignal: clamp(recentReturn, -0.5, 0.5),
newsCount: sentiment.count,
shock: shock.shock,
thinkingStyle: 0.5,
psiState: ctx.psiState,
});
const psi = {
s: sentiment.S,
e: sentiment.E,
c: psychResult.factors.c,
m: momentum,
t: 0.5,
scalar: psychResult.psiScalar,
};

const gSigma = garch.sigma;
const piHalf = 0.5 * psi.scalar * gSigma;
const sigmaBand = clamp(1 + Math.abs(psi.scalar) * 0.3, 0.7, 1.3);
const drift = (meanLogReturn(closes) + piHalf + 0.5 * piHalf * piHalf)
* sigmaBand;
const hp = getHestonParams(regime);
const mc = hestonMonteCarlo(
S0,
drift,
gSigma * gSigma,
hp.kappa,
garch.longVar * hp.thetaScale,
hp.xi,
hp.rho,
horizonDays,
s.mcPaths,
);

const featureVec = buildFeatureVector({
closes,
rsi: tech.rsi,
macdHist: tech.macd.hist,
sma20: tech.sma20,
sma50: tech.sma50,
sma200: tech.sma200,
garchSigma: gSigma,
longVol: garch.longVar,
sentiment: psi.scalar,
volumeRatio,
hurst,
});
const trained = predictTrainedHeads(featureVec, closes,
ctx.modelArtifacts, horizonDays);
const models = {
markov: trained.markov,
arimaLstm: trained.arimaLstm,
lstm: trained.lstm,
xgb: trained.xgb,
rf: trained.rf,
};

const ensemble = ensembleYhat(models, w, regime);
const mcReturn = (mc.mean - S0) / S0;
const fractal = computeFractalFeatures(calibrationCloses);
const fractalHead = fractalModelHead(calibrationCloses, psi.scalar,
gSigma);
const rw = getRegimeWeights(regime);
const blended =
rw.ensembleW * ensemble.yhat +
rw.mcW * mcReturn +
rw.fractalW * fractalHead.expectedReturn;
const expectedReturn = clamp(blended, -0.6, 0.6);
const predictedPrice = S0 * (1 + expectedReturn);
const modelVals = Object.values(models).map((m) => m.yhat);
const sorted = [...modelVals].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
const mad = modelVals.reduce((a, x) => a + Math.abs(x - median), 0) /
(modelVals.length || 1);
const disagreementPenalty = clamp(1 - mad / 0.1, 0, 1);
const ensembleConf = clamp(psychResult.posteriorPsi *
disagreementPenalty, 0, 1);
const fractalConf = 0.5 + 0.5 * (fractalHead.directionProb - 0.5);
const confidence = clamp(
rw.ensembleW * ensembleConf + rw.mcW * mc.confidence + rw.fractalW *
fractalConf,
0,
1,
);

const ctmuBase = ctmuScores(ensemble, psi, regime, shock.shock);
const ctmuMods = computeCTMUFractal(fractal, regime);
const ctmu = {
telic: clamp(ctmuBase.telic * ctmuMods.telicMod, 0, 1),
hology: clamp(ctmuBase.hology * ctmuMods.hologyMod, 0, 1),
dissonance: clamp(ctmuBase.dissonance * ctmuMods.dissonanceMod, 0, 1),
mode: ctmuBase.mode,
};

const valid = ctmuValid(ctmu, s);
const signalQuality = clamp(
0.5 * confidence + 0.3 * ctmu.hology + 0.2 * (1 - ctmu.dissonance),
0,
1,
);

const gate = superGate({
expectedReturn,
confidence,
quality: signalQuality,
ctmuScores: ctmu,
valid,
minReturn: s.minReturn,
minConfidence: s.minConfidence,
minQuality: s.minQuality,
});
const kellyPct =
gate.signal !== "AVOID"
? kellyFraction(expectedReturn, gSigma, confidence, ctmu.telic,
ctmu.hology, s.maxDrawdownPct)
: 0;
const volAtr = tech.atr || S0 * 0.02;
const dir = gate.signal === "SELL" ? -1 : 1;
const stopLoss = gate.signal === "AVOID" ? S0 : S0 - dir * 1.5 *
volAtr;
const takeProfit = gate.signal === "AVOID" ? S0 : S0 + dir * 3 *
volAtr;
const prediction: Prediction = {
ticker,
assetType: "Stock",
horizonDays,
entryPrice: S0,
predictedPrice,
expectedReturn,
confidence,
signal: gate.signal,
tradeGrade: gate.grade,
signalQuality,
regime,
ctmu,
psi,
bayes: {
prior: psychResult.prior,
likelihood: psychResult.likelihood,
posterior: psychResult.posteriorPsi,
},
ensemble: { ...models, weights: w, disagreementPenalty, source:
trained.source },
mc: { mean: mc.mean, p5: mc.p5, p95: mc.p95 },
garchVol: gSigma,
hurst,
stopLoss,
takeProfit,
kellyPct,
rationale: templateRationale({
ticker,
signal: gate.signal,
regime,
expectedReturn,
psi: psi.scalar,
}),
resolved: false,
horizonEndDate: tradingDayHorizonEnd(horizonDays),
createdAt: new Date().toISOString(),
};

const snapshot = {
tech,
sentiment,
shock,
garch,
volumeRatio,
adaptiveWeights: psychResult.adaptiveWeights,
modelSource: trained.source,
fractal: {
H_global: fractal.H_global,
expectedReturn: fractalHead.expectedReturn,
regimeWeights: rw,
},
};

return { prediction, snapshot };
}

export async function runAdvancedPipeline(
ticker: string,
horizonDays = 14,
settingsOverride: Partial<Settings> = {},
opts: { persist?: boolean; mcPaths?: number } = {},
) {
const weights = await getWeights();
const settings = { ...(await getSettings()), ...settingsOverride };
if (opts.mcPaths) settings.mcPaths = opts.mcPaths;
const psiSession = createPsiSession();
const modelArtifacts = await loadModelArtifacts();
const { ohlc, ohlcLong, news, quote } = await fetchInputData(ticker);
const { prediction, snapshot } = computeEngine(
ticker,
ohlc,
news,
horizonDays,
weights,
settings,
{ ohlcLong, quote, psiState: psiSession.state, modelArtifacts },
);

if (opts.persist !== false) {
const saved = await savePrediction(prediction);
return { prediction: saved, snapshot };
}

return { prediction, snapshot };
}
