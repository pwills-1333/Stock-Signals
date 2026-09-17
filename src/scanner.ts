import { clamp } from "./stats.ts";
import { fetchUSSymbols } from "./data/finnhub.ts";
import { computeEngine, fetchInputData } from "./pipeline.ts";
import { createPsiSession } from "./psi/adaptivePsi.ts";
import { loadModelArtifacts } from "./trainedModels.ts";
import { getSettings, getWeights } from "./store.ts";
import { DEFAULT_WEIGHTS } from "./config.ts";

export async function scanTicker(
  ticker: string,
  horizonDays = 14,
  weights = DEFAULT_WEIGHTS,
  settings: any,
  psiState: any,
  modelArtifacts: any,
) {
  const { ohlc, ohlcLong, news, xposts, quote } = await fetchInputData(ticker);
  const { prediction, snapshot } = computeEngine(
    ticker, ohlc, news, horizonDays, weights,
    { ...settings, mcPaths: 400 },
    { ohlcLong, quote, psiState, modelArtifacts, xposts },
  );

  const avgVolume = snapshot.tech?.avgVolume ?? 0;
  if (prediction.entryPrice < 3 || avgVolume < 80_000) {
    return { ticker, signal: "AVOID", grade: "F", expectedReturn: 0, confidence: 0, composite: 0, _filtered: true };
  }

  const catalyst = snapshot.shock ? snapshot.shock.score : 0;
  const base =
    0.30 * (Math.abs(prediction.expectedReturn) / (settings.minReturn || 0.015)) +
    0.25 * prediction.signalQuality +
    0.20 * prediction.ctmu.R +
    0.15 * catalyst +
    0.10 * prediction.confidence;

  const gatePass = prediction.signal !== "AVOID";
  const composite = clamp(base * (gatePass ? 1 : 0.12), 0, 2.5);

  return {
    ticker,
    signal: prediction.signal,
    grade: prediction.tradeGrade,
    expectedReturn: prediction.expectedReturn,
    confidence: prediction.confidence,
    signalQuality: prediction.signalQuality,
    regime: prediction.regime,
    R: prediction.ctmu.R,
    composite,
    entryPrice: prediction.entryPrice,
    predictedPrice: prediction.predictedPrice,
  };
}

export async function runScreener(universe: string[] = [], horizonDays = 14, limit = 12) {
  let tickers = [...new Set(universe.map((t) => t.toUpperCase()).filter(Boolean))];
  if (tickers.length < 30) {
    try {
      const all = await fetchUSSymbols();
      tickers = [...tickers, ...all.filter((t) => !tickers.includes(t)).slice(0, 40)];
    } catch {
      tickers = [...tickers, "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "AMD", "TSLA"];
    }
  }

  const weights = await getWeights();
  const settings = await getSettings();
  const modelArtifacts = await loadModelArtifacts();
  const CONCURRENCY = 3;
  const ranked: any[] = [];

  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (tk) => {
        try {
          const localPsi = createPsiSession();
          return await scanTicker(tk, horizonDays, weights, settings, localPsi.state, modelArtifacts);
        } catch (e) {
          return { ticker: tk, signal: "AVOID", composite: 0, _error: String(e) };
        }
      }),
    );
    ranked.push(...results);
  }

  ranked.sort((a, b) => (b.composite || 0) - (a.composite || 0));
  const picks = ranked.filter((p) => !p._filtered && !p._error).slice(0, limit);

  return { horizonDays, scanned: tickers.length, picks, modelSource: modelArtifacts ? "trained" : "heuristic" };
}
