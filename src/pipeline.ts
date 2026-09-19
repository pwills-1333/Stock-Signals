import { runAllHeads, aggregateHeads } from "./trainedModels.ts";
import { OHLC, Prediction } from "./types.ts";
import { buildFeatures } from "./mlFeatures.ts";
import { fetchOHLC } from "./data.ts";
import { loadAllArtifacts } from "../artifacts/multiArtifacts.ts";  // FIXED PATH

import {
  detectRegime,
  weightHeadsByRegime,
  applyHeadWeights
} from "./regimeSelector.ts";

export async function predict(input: {
  ticker: string;
  horizonDays: number;
}): Promise<Prediction> {
  const { ticker, horizonDays } = input;

  const ohlc: OHLC | null = await fetchOHLC(ticker);
  if (!ohlc || ohlc.c.length < 50) {
    return {
      ticker,
      assetType: "equity",
      horizonDays,
      entryPrice: 0,
      predictedPrice: 0,
      expectedReturn: 0,
      confidence: 0,
      signal: "neutral",
      tradeGrade: 0,
      signalQuality: 0,
      regime: "neutral",
      ctmu: 0,
      psi: 0,
      bayes: 0,
      ensemble: 0,
      mc: 0,
      garchVol: 0,
      hurst: 0,
      stopLoss: 0,
      takeProfit: 0,
      kellyPct: 0,
      rationale: "Insufficient data",
      resolved: false,
      horizonEndDate: new Date(Date.now() + horizonDays * 86400000).toISOString(),
      createdAt: new Date().toISOString()
    };
  }

  const features = buildFeatures(ohlc);

  const artifact = await loadAllArtifacts("src/artifacts");

  let expectedReturn = 0;
  let confidence = 0;
  let signal: Prediction["signal"] = "neutral";
  let regime = "neutral";

  if (artifact) {
    const headOutputs = runAllHeads(artifact, features);

    const rawAgg = aggregateHeads(headOutputs);

    const regimeInputs = {
      expectedReturn: rawAgg.expectedReturn,
      confidence: rawAgg.confidence,
      hurst: 0,
      volatility: 0,
      chaos: 0,
      ctrA: rawAgg.expectedReturn
    };

    regime = detectRegime(regimeInputs);

    const weights = weightHeadsByRegime(regime, artifact.heads);

    const weightedOutputs = applyHeadWeights(headOutputs, weights);

    const agg = aggregateHeads(weightedOutputs);

    expectedReturn = agg.expectedReturn;
    confidence = agg.confidence;
    signal = agg.signal;
  }

  const entryPrice = ohlc.c[ohlc.c.length - 1];
  const predictedPrice = entryPrice * (1 + expectedReturn);

  return {
    ticker,
    assetType: "equity",
    horizonDays,
    entryPrice,
    predictedPrice,
    expectedReturn,
    confidence,
    signal,
    tradeGrade: confidence,
    signalQuality: confidence,
    regime,
    ctmu: expectedReturn,
    psi: confidence,
    bayes: expectedReturn * confidence,
    ensemble: expectedReturn,
    mc: expectedReturn,
    garchVol: 0,
    hurst: 0,
    stopLoss: entryPrice * 0.95,
    takeProfit: entryPrice * 1.05,
    kellyPct: Math.max(0, Math.min(1, expectedReturn * confidence)),
    rationale: "Regime-weighted model forecast",
    resolved: false,
    horizonEndDate: new Date(Date.now() + horizonDays * 86400000).toISOString(),
    createdAt: new Date().toISOString()
  };
}

export async function predict(input: {
  ticker: string;
  horizonDays: number;
}): Promise<Prediction> {
  const { ticker, horizonDays } = input;

  const ohlc: OHLC | null = await fetchOHLC(ticker);
  if (!ohlc || ohlc.c.length < 50) {
    return {
      ticker,
      assetType: "equity",
      horizonDays,
      entryPrice: 0,
      predictedPrice: 0,
      expectedReturn: 0,
      confidence: 0,
      signal: "neutral",
      tradeGrade: 0,
      signalQuality: 0,
      regime: "neutral",
      ctmu: 0,
      psi: 0,
      bayes: 0,
      ensemble: 0,
      mc: 0,
      garchVol: 0,
      hurst: 0,
      stopLoss: 0,
      takeProfit: 0,
      kellyPct: 0,
      rationale: "Insufficient data",
      resolved: false,
      horizonEndDate: new Date(Date.now() + horizonDays * 86400000).toISOString(),
      createdAt: new Date().toISOString()
    };
  }

  const features = buildFeatures(ohlc);

  const artifact = await loadAllArtifacts("src/artifacts");

  let expectedReturn = 0;
  let confidence = 0;
  let signal: Prediction["signal"] = "neutral";
  let regime = "neutral";

  if (artifact) {
    const headOutputs = runAllHeads(artifact, features);

    const rawAgg = aggregateHeads(headOutputs);

    const regimeInputs = {
      expectedReturn: rawAgg.expectedReturn,
      confidence: rawAgg.confidence,
      hurst: 0,
      volatility: 0,
      chaos: 0,
      ctrA: rawAgg.expectedReturn
    };

    regime = detectRegime(regimeInputs);

    const weights = weightHeadsByRegime(regime, artifact.heads);

    const weightedOutputs = applyHeadWeights(headOutputs, weights);

    const agg = aggregateHeads(weightedOutputs);

    expectedReturn = agg.expectedReturn;
    confidence = agg.confidence;
    signal = agg.signal;
  }

  const entryPrice = ohlc.c[ohlc.c.length - 1];
  const predictedPrice = entryPrice * (1 + expectedReturn);

  return {
    ticker,
    assetType: "equity",
    horizonDays,
    entryPrice,
    predictedPrice,
    expectedReturn,
    confidence,
    signal,
    tradeGrade: confidence,
    signalQuality: confidence,
    regime,
    ctmu: expectedReturn,
    psi: confidence,
    bayes: expectedReturn * confidence,
    ensemble: expectedReturn,
    mc: expectedReturn,
    garchVol: 0,
    hurst: 0,
    stopLoss: entryPrice * 0.95,
    takeProfit: entryPrice * 1.05,
    kellyPct: Math.max(0, Math.min(1, expectedReturn * confidence)),
    rationale: "Regime-weighted model forecast",
    resolved: false,
    horizonEndDate: new Date(Date.now() + horizonDays * 86400000).toISOString(),
    createdAt: new Date().toISOString()
  };
}
