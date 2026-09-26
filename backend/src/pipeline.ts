// backend/src/pipeline.ts
import type { OHLC, Prediction, Regime } from "./types.ts";
import { fetchOHLC } from "./data.ts";
import { buildFeatures } from "./mlFeatures.ts";
import { loadAllArtifacts } from "../artifacts/multiArtifacts.ts";
import { runAllHeads, aggregateHeads } from "./trainedModels.ts";
import {
  detectRegime,
  weightHeadsByRegime,
  applyHeadWeights,
} from "./regimeSelector.ts";
import { computeFractalSignal } from "./fractal.ts";
import { atr } from "./stats.ts";
import { computeAdaptivePsi } from "./psi/adaptivePsi.ts";
import { computeCtrA } from "./ctmu/ctrA.ts";

export async function predict(input: {
  ticker: string;
  horizonDays?: number;
}): Promise<Prediction> {
  const ticker = (input.ticker || "").toUpperCase().trim();
  const horizonDays = input.horizonDays ?? 14;

  // 1. Fetch data
  const ohlc: OHLC | null = await fetchOHLC(ticker);
  if (!ohlc || ohlc.c.length < 50) {
    return createEmptyPrediction(ticker, horizonDays, "Insufficient data");
  }

  const closes = ohlc.c;
  const entryPrice = closes[closes.length - 1];

  if (!(entryPrice > 0)) {
    return createEmptyPrediction(ticker, horizonDays, "Invalid last price");
  }

  // 2. Features
  const features = buildFeatures(ohlc);

  // 3. Load models
  const artifact = await loadAllArtifacts("artifacts");
  if (!artifact || !artifact.heads?.length) {
    return createEmptyPrediction(
      ticker,
      horizonDays,
      "No model artifacts found",
    );
  }

  // 4. Run all heads
  const headOutputs = runAllHeads(artifact, features);
  const rawAgg = aggregateHeads(headOutputs);

  // 5. Real market regime inputs
  const fractal = computeFractalSignal(closes);
  const atr14 = atr(ohlc.h, ohlc.l, ohlc.c, 14);
  const volatility = entryPrice > 0 ? atr14 / entryPrice : 0;

  const regimeInputs = {
    expectedReturn: rawAgg.expectedReturn,
    confidence: rawAgg.confidence,
    hurst: fractal.hurst,
    volatility,
    chaos: fractal.chaos ? 0.6 : 0.1,
    ctrA: rawAgg.expectedReturn, // refined after CTR-A below
  };

  const regime = detectRegime(regimeInputs) as Regime;

  // 6. Regime-weighted aggregation
  const weights = weightHeadsByRegime(regime, artifact.heads);
  const weightedOutputs = applyHeadWeights(headOutputs, weights);
  const agg = aggregateHeads(weightedOutputs);

  let expectedReturn = agg.expectedReturn;
  let confidence = agg.confidence;
  let signal = agg.signal;

  // 7. Adaptive Ψ
  const psiOut = computeAdaptivePsi({
    expectedReturn,
    confidence,
    volatility,
    closes,
  });

  // 8. CTR-A
  const ctrAOut = computeCtrA({
    closes,
    expectedReturn,
    confidence,
    psi: psiOut.psi,
  });

  // 9. Final blending — do NOT mix CTR-A ([-1,1] score) into return scale
  const ctrA = ctrAOut.ctrA;
  const psiGrade = psiOut.grade;

  // Small directional bias from CTR-A (capped as a return contribution)
  const ctrAReturnBias = Math.max(-0.05, Math.min(0.05, ctrA * 0.03));
  expectedReturn = expectedReturn + ctrAReturnBias;

  // Confidence: ensemble + Ψ grade, lightly gated by stability
  const stabilityBoost =
    0.85 + 0.15 * Math.min(1, Math.abs(ctrAOut.stability ?? 0.5));
  confidence = Math.min(
    1,
    Math.max(0, (confidence * 0.55 + psiGrade * 0.45) * stabilityBoost),
  );

  if (psiOut.signal === "buy" && signal === "neutral") signal = "buy";
  if (psiOut.signal === "sell" && signal === "neutral") signal = "sell";

  // Clamp expected return for a ~14d horizon
  expectedReturn = Math.max(-0.25, Math.min(0.25, expectedReturn));

  // 10. ATR-based risk (direction-aware)
  const atrMult = Math.max(volatility, 0.008);
  const stopLoss =
    signal === "sell"
      ? entryPrice * (1 + 1.8 * atrMult)
      : entryPrice * (1 - 1.8 * atrMult);
  const takeProfit =
    signal === "sell"
      ? entryPrice * (1 - 2.5 * atrMult)
      : entryPrice * (1 + 2.5 * atrMult);

  // Kelly: magnitude from |edge|; direction is signal
  const edge = Math.abs(expectedReturn) * confidence;
  const kellyPct = Math.max(0, Math.min(0.25, edge * 0.5));

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
    tradeGrade: psiOut.grade,
    signalQuality: confidence,
    regime,
    ctmu: ctrAOut.ctrA,
    psi: psiOut.psi,
    bayes: expectedReturn * confidence,
    ensemble: expectedReturn,
    mc: expectedReturn,
    garchVol: volatility,
    hurst: fractal.hurst,
    stopLoss,
    takeProfit,
    kellyPct,
    rationale:
      `Regime: ${regime} | Ψ: ${psiOut.psi.toFixed(3)} | CTR-A: ${ctrAOut.ctrA.toFixed(3)} | Fractal Hurst: ${fractal.hurst.toFixed(3)}`,
    resolved: false,
    horizonEndDate: new Date(
      Date.now() + horizonDays * 86_400_000,
    ).toISOString(),
    createdAt: new Date().toISOString(),
  };
}

function createEmptyPrediction(
  ticker: string,
  horizonDays: number,
  rationale: string,
): Prediction {
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
    hurst: 0.5,
    stopLoss: 0,
    takeProfit: 0,
    kellyPct: 0,
    rationale,
    resolved: false,
    horizonEndDate: new Date(
      Date.now() + horizonDays * 86_400_000,
    ).toISOString(),
    createdAt: new Date().toISOString(),
  };
}
