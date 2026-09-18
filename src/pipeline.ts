import { fetchFinnhubOHLC, fetchQuote, fetchCompanyNews } from "./data/finnhub.ts";
import { fetchYahooOHLC, scoreSentiment, detectShock } from "./data/yahoo.ts";
import { fetchBroadNews } from "./data/news.ts";
import { fetchXPosts, scoreXSentiment } from "./data/xposts.ts";
import { runEnsemble } from "./models.ts";
import { fractalBlend } from "./fractal.ts";
import { createPsiSession, runPsi } from "./psi/adaptivePsi.ts";
import { runCTRA, buildMarketEvents } from "./ctmu/ctrA.ts";
import { loadModelArtifacts } from "./trainedModels.ts";
import { getWeights, getSettings, savePrediction } from "./store.ts";
import { clamp, std, logReturns, atr } from "./stats.ts";
import type { OHLC, Prediction, Settings, Weights } from "./types.ts";
import { DEFAULT_SETTINGS } from "./config.ts";

export async function fetchInputData(ticker: string) {
  const sources: string[] = [];
  let ohlc: OHLC | null = await fetchFinnhubOHLC(ticker, 200);
  if (ohlc) sources.push("finnhub");
  else {
    ohlc = await fetchYahooOHLC(ticker, 200);
    sources.push("yahoo");
  }

  let ohlcLong = ohlc;
  try {
    const longer = await fetchYahooOHLC(ticker, 400);
    if (longer.c.length > (ohlc?.c.length || 0)) {
      ohlcLong = longer;
      sources.push("yahoo-long");
    }
  } catch { /* ignore */ }

  const news = await fetchBroadNews(ticker);
  const xposts = await fetchXPosts(ticker);
  const quote = await fetchQuote(ticker);

  return { ohlc: ohlc!, ohlcLong: ohlcLong!, news, xposts, quote, sources };
}

export function computeEngine(
  ticker: string,
  ohlc: OHLC,
  news: { title: string; summary: string }[],
  horizonDays: number,
  weights: Weights,
  settings: Settings,
  opts: {
    ohlcLong?: OHLC;
    quote?: { price: number } | null;
    psiState: any;
    modelArtifacts: any;
    xposts?: any[];
  },
) {
  const closes = ohlc.c;
  const entryPrice = opts.quote?.price || closes[closes.length - 1];
  const sent = scoreSentiment(news);
  const xSent = scoreXSentiment(opts.xposts || []);
  const combinedS = clamp((sent.S * 0.7 + xSent.S * 0.3), -1, 1);
  const combinedE = clamp((sent.E * 0.6 + xSent.E * 0.4), 0, 1);

  // Volume ratio
  const vols = ohlc.v;
  const avgVol = vols.slice(-20).reduce((a, b) => a + b, 0) / 20 || 1;
  const volRatio = (vols[vols.length - 1] || 0) / avgVol;

  // Regime
  const hurst = fractalBlend(0, closes).hurst;
  let regime: "trend" | "meanReversion" | "chaos" = "chaos";
  if (hurst > 0.58) regime = "trend";
  else if (hurst < 0.42) regime = "meanReversion";

  // Ensemble
  const ens = runEnsemble(ohlc, combinedS, weights, opts.modelArtifacts);
  let expectedReturn = ens.yhat;

  // Fractal adjustment
  const frac = fractalBlend(expectedReturn, closes);
  expectedReturn = frac.adjustedReturn;

  // Ψ
  const psiIn = {
    S: combinedS,
    E: combinedE,
    C: clamp(Math.abs(combinedS) * 0.6, 0, 1), // bias proxy
    M: clamp(volRatio / 3, 0, 1),
    T: regime === "trend" ? 0.4 : regime === "meanReversion" ? -0.3 : 0,
    corr: 0.4,
    vol: std(logReturns(closes).slice(-20)) || 0.02,
  };
  const psiOut = runPsi(opts.psiState, psiIn, {
    error: 0,
    coherence: 0.5,
  });

  // Apply Ψ drift
  expectedReturn += psiOut.drift * (horizonDays / 14);

  // CTR-A
  const events = buildMarketEvents(ticker, closes, vols, sent.items || [], regime);
  const ctr = runCTRA(events);

  // GARCH-like vol
  const garchVol = (std(logReturns(closes).slice(-30)) || 0.02) * psiOut.volMult;

  // Monte-Carlo rough
  const mcPaths = settings.mcPaths || 1500;
  const paths: number[] = [];
  for (let i = 0; i < mcPaths; i++) {
    let p = entryPrice;
    for (let d = 0; d < horizonDays; d++) {
      p *= Math.exp((expectedReturn / horizonDays) - 0.5 * garchVol ** 2 + garchVol * (Math.random() * 2 - 1));
    }
    paths.push(p);
  }
  paths.sort((a, b) => a - b);
  const mcMean = paths.reduce((a, b) => a + b, 0) / paths.length;
  const p5 = paths[Math.floor(mcPaths * 0.05)];
  const p95 = paths[Math.floor(mcPaths * 0.95)];

  // Final predicted price
  const predictedPrice = entryPrice * (1 + expectedReturn);

  // Confidence & gates
  let confidence = clamp(
    ens.quality * 0.45 +
    ctr.R * 0.30 +
    (1 - Math.abs(psiOut.total) * 0.15) * 0.15 +
    0.1,
    0.15,
    0.95,
  );

  let signal = "HOLD";
  if (expectedReturn > settings.minReturn && ctr.R >= settings.minCoherenceR && confidence > settings.minConfidence) {
    signal = "BUY";
  } else if (expectedReturn < -settings.minReturn && ctr.R >= settings.minCoherenceR) {
    signal = "SELL";
  } else if (ctr.R < settings.minCoherenceR || ctr.GI < settings.minGI) {
    signal = "AVOID";
  }

  const tradeGrade =
    confidence > 0.75 && Math.abs(expectedReturn) > 0.04 ? "A" :
    confidence > 0.6 && Math.abs(expectedReturn) > 0.025 ? "B" :
    confidence > 0.45 ? "C" : "D";

  const atrVal = atr(ohlc.h, ohlc.l, ohlc.c);
  const stopLoss = signal === "BUY" ? entryPrice - 1.8 * atrVal : entryPrice + 1.8 * atrVal;
  const takeProfit = signal === "BUY" ? entryPrice + 3.2 * atrVal : entryPrice - 3.2 * atrVal;

  const kellyPct = clamp(
    (expectedReturn * confidence) / (garchVol * Math.sqrt(horizonDays) + 1e-6),
    0,
    0.25,
  );

  const prediction: Prediction = {
    ticker,
    assetType: "stock",
    horizonDays,
    entryPrice,
    predictedPrice,
    expectedReturn,
    confidence,
    signal,
    tradeGrade,
    signalQuality: ens.quality,
    regime,
    ctmu: {
      telic: ctr.telic,
      hology: ctr.hology,
      dissonance: ctr.dissonance,
      mode: ctr.mode,
      R: ctr.R,
      GI: ctr.GI,
      RC: ctr.RC,
      meaningScore: ctr.meaningScore,
    },
    psi: {
      s: psiOut.s,
      e: psiOut.e,
      c: psiOut.c,
      m: psiOut.m,
      t: psiOut.t,
      scalar: psiOut.scalar,
      total: psiOut.total,
    },
    bayes: {
      prior: 0.5,
      likelihood: 0.5 + expectedReturn * 2,
      posterior: confidence,
    },
    ensemble: ens.components,
    mc: { mean: mcMean, p5, p95 },
    garchVol,
    hurst: frac.hurst,
    stopLoss,
    takeProfit,
    kellyPct,
    rationale: `Ψ=${psiOut.total.toFixed(3)} CTR-A R=${ctr.R.toFixed(3)} regime=${regime}`,
    resolved: false,
    horizonEndDate: new Date(Date.now() + horizonDays * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    sourcesUsed: [],
  };

  return { prediction, snapshot: { tech: { avgVolume: avgVol }, sentiment: sent, shock: detectShock(sent, volRatio), garch: { sigma: garchVol } } };
}

export async function runAdvancedPipeline(
  ticker: string,
  horizonDays = 14,
  settingsOverride: Partial<Settings> = {},
  opts: { persist?: boolean; mcPaths?: number } = {},
) {
  const weights = await getWeights();
  const settings = { ...DEFAULT_SETTINGS, ...(await getSettings()), ...settingsOverride };
  if (opts.mcPaths) settings.mcPaths = opts.mcPaths;

  const psiSession = createPsiSession();
  const modelArtifacts = await loadModelArtifacts();
  const { ohlc, ohlcLong, news, xposts, quote, sources } = await fetchInputData(ticker);

  const { prediction, snapshot } = computeEngine(
    ticker,
    ohlc,
    news,
    horizonDays,
    weights,
    settings,
    { ohlcLong, quote, psiState: psiSession.state, modelArtifacts, xposts },
  );
  prediction.sourcesUsed = sources;

  import { trainedHeads } from "./trainedModels.ts";  // ← add at top of file if missing

if (opts.persist !== false) {
  const saved = await savePrediction(prediction);
  return { 
    prediction: saved, 
    snapshot,
    markov: modelArtifacts.markov   // ← ADD THIS LINE
  };
}

return { 
  prediction, 
  snapshot,
  markov: modelArtifacts.markov     // ← ADD THIS LINE
};
  }
  return { prediction, snapshot };
}
