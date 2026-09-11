import { clamp } from "./stats.ts";
import { fetchUSSymbols } from "./finnhub.ts";
import { computeEngine, fetchInputData } from "./pipeline.ts";
import { createPsiSession } from "./adaptivePsi.ts";
import { loadModelArtifacts } from "./trainedModels.ts";
import { getSettings, getWeights } from "./store.ts";
import { DEFAULT_WEIGHTS } from "./config.ts";

export async function scanTicker(
ticker: string,
horizonDays = 14,
weights = DEFAULT_WEIGHTS,
settings: Awaited<ReturnType<typeof getSettings>>,
psiState: ReturnType<typeof createPsiSession>["state"],
modelArtifacts: Record<string, unknown> | null,
) {
const { ohlc, ohlcLong, news, quote } = await fetchInputData(ticker);
const { prediction, snapshot } = computeEngine(
ticker,
ohlc,
news,
horizonDays,
weights,
{ ...settings, mcPaths: 500 },
{ ohlcLong, quote, psiState, modelArtifacts },
);

const avgVolume = snapshot.tech?.avgVolume ?? 0;
const minReturn = settings.minReturn ?? 0.015;
if (prediction.entryPrice < 3 || avgVolume < 100_000) {
return {
ticker,
signal: "AVOID",
grade: "F",
expectedReturn: prediction.expectedReturn,
confidence: prediction.confidence,
composite: 0,
_filtered: true,
_reason: "illiquid",
};

}

const catalyst = snapshot.shock
? snapshot.shock.score
: snapshot.sentiment.E * Math.abs(snapshot.sentiment.S);
const dailySigma = snapshot.garch?.sigma || 0.02;
const volNorm = clamp(1 / (dailySigma * Math.sqrt(Math.max(horizonDays,
1))), 0.5, 2);
const base =
0.35 * (Math.abs(prediction.expectedReturn) / minReturn) * volNorm +
0.20 * prediction.signalQuality +
0.15 * catalyst +
0.30 * (prediction.ctmu.telic * prediction.ctmu.hology);
const gatePass =
prediction.signal !== "AVOID" && Math.abs(prediction.expectedReturn)
>= minReturn;
const composite = clamp(base * (gatePass ? 1 : 0.15), 0, 2.5);
return {
ticker,
signal: prediction.signal,
grade: prediction.tradeGrade,
expectedReturn: prediction.expectedReturn,
confidence: prediction.confidence,
signalQuality: prediction.signalQuality,
regime: prediction.regime,
telic: prediction.ctmu.telic,
hology: prediction.ctmu.hology,
dissonance: prediction.ctmu.dissonance,
catalyst,
composite,
entryPrice: prediction.entryPrice,
predictedPrice: prediction.predictedPrice,
avgVolume,
};

}

function shuffle<T>(arr: T[]) {
for (let i = arr.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[arr[i], arr[j]] = [arr[j], arr[i]];
}

return arr;
}

export async function runScreener(universe: string[] = [],
horizonDays = 14, limit = 12) {
let tickers = [...new Set(universe.map((t) =>
t.toUpperCase()).filter(Boolean))];
const wanted = Math.max(limit, 40);
if (tickers.length < wanted) {
try {
const all = await fetchUSSymbols();
tickers = [
...tickers,
...shuffle(all.filter((t) => !tickers.includes(t))).slice(0, wanted -
tickers.length),
];
} catch {
tickers = [
...tickers,
...shuffle(["AAPL", "MSFT", "NVDA", "AMZN", "TSLA",
"META", "AMD", "JPM"]).slice(
0,
wanted - tickers.length,
),
];
}

}

const weights = await getWeights();
const settings = await getSettings();
const psiSession = createPsiSession();
const modelArtifacts = await loadModelArtifacts();
const CONCURRENCY = 4; // lowered slightly for free Finnhub rate limits
const ranked: Awaited<ReturnType<typeof scanTicker>>[] = [];
let filtered = 0;
for (let i = 0; i < tickers.length; i += CONCURRENCY) {
const batch = tickers.slice(i, i + CONCURRENCY);
const base = psiSession.snapshot();
const results = await Promise.all(
batch.map(async (tk) => {
try {
const local = createPsiSession(base);
return await scanTicker(tk, horizonDays, weights, settings, local.state,
modelArtifacts);
} catch (e) {
return {
ticker: tk,
signal: "AVOID",
grade: "F",
expectedReturn: 0,
confidence: 0,
composite: 0,
_error: String((e as Error).message || e),
} as Awaited<ReturnType<typeof scanTicker>> & { _error?: string };
}

}),
);

for (const r of results) {
if ("_filtered" in r && r._filtered) filtered++;
ranked.push(r);
}

}

ranked.sort((a, b) => (b.composite || 0) - (a.composite || 0));
const picks = ranked
.filter((p) => !("_error" in p && p._error) && !("_filtered" in
p && p._filtered))
.slice(0, limit);
return {
horizonDays,
scanned: tickers.length,
filtered,
picks,
modelSource: modelArtifacts ? "trained" : "heuristic",
};

}
