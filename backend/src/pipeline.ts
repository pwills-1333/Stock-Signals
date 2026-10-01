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
import {
  fetchCombinedSentiment,
  applySentimentBias,
} from "./data/sentiment.ts";
import {
  getPsiWeights,
  getCtrAWeights,
  getTickerError,
} from "./learning/state.ts";

export async function predict(input: {
  ticker: string;
  horizonDays?: number;
}): Promise<Prediction> {
  const ticker = (input.ticker || "").toUpperCase().trim();
  const horizonDays = input.horizonDays ?? 14;

  const ohlc: OHLC | null = await fetchOHLC(ticker);
  if (!ohlc || ohlc.c.length < 50) {
    return createEmptyPrediction(ticker, horizonDays, "Insufficient data");
  }

  const closes = ohlc.c;
  const entryPrice = closes[closes.length - 1];

  if (!(entryPrice > 0)) {
    return createEmptyPrediction(ticker, horizonDays, "Invalid last price");
  }

  const features = buildFeatures(ohlc);

  const artifact = await loadAllArtifacts("artifacts");
  if (!artifact || !artifact.heads?.length) {
    return createEmptyPrediction(
      ticker,
      horizonDays,
      "No model artifacts found",
    );
  }

  const headOutputs = runAllHeads(artifact, features);
  const rawAgg = aggregateHeads(headOutputs);

  const fractal = computeFractalSignal(closes);
  const atr14 = atr(ohlc.h, ohlc.l, ohlc.c, 14);
  const volatility = entryPrice > 0 ? atr14 / entryPrice : 0;

  const regimeInputs = {
    expectedReturn: rawAgg.expectedReturn,
    confidence: rawAgg.confidence,
    hurst: fractal.hurst,
    volatility,
    chaos: fractal.chaos ? 0.6 : 0.1,
    ctrA: rawAgg.expectedReturn,
  };

  let regime = detectRegime(regimeInputs) as Regime;

  const headWeights = weightHeadsByRegime(regime, artifact.heads);
  const weightedOutputs = applyHeadWeights(headOutputs, headWeights);
  const agg = aggregateHeads(weightedOutputs);

  let expectedReturn = agg.expectedReturn;
  let confidence = agg.confidence;
  let signal = agg.signal;

  let sentimentScore = 0;
  let sentimentMagnitude = 0;
  let sentimentBias = 0;

  try {
    const sentiment = await fetchCombinedSentiment(ticker);
    sentimentScore = sentiment.score;
    sentimentMagnitude = sentiment.magnitude;

    const biased = applySentimentBias(
      expectedReturn,
      confidence,
      sentiment,
    );
    expectedReturn = biased.expectedReturn;
    confidence = biased.confidence;
    sentimentBias = biased.biasApplied;

    if (
      sentiment.magnitude >= 4 &&
      Math.abs(sentiment.score) >= 0.35 &&
      (regime === "neutral" ||
        regime === "trend" ||
        regime === "meanReversion")
    ) {
      const sentCtrA =
        sentiment.score * Math.min(1, sentiment.magnitude / 6);
      const regime2 = detectRegime({
        ...regimeInputs,
        expectedReturn,
        confidence,
        ctrA: sentCtrA,
      }) as Regime;

      if (
        regime2 === "fundamentalBull" ||
        regime2 === "fundamentalBear"
      ) {
        regime = regime2;
      }
    }
  } catch (err) {
    console.warn("Sentiment layer failed (non-fatal):", err);
  }

  // --- Recursive learning: global weights + per-ticker e_t ---
  const [psiWeights, ctrAWeights, tickerError] = await Promise.all([
    getPsiWeights(),
    getCtrAWeights(),
    getTickerError(ticker),
  ]);

  const psiOut = await computeAdaptivePsi({
    expectedReturn,
    confidence,
    volatility,
    closes,
    weights: psiWeights,
  });

  const ctrAOut = await computeCtrA({
    closes,
    expectedReturn,
    confidence,
    psi: psiOut.psi,
    ticker,
    weights: ctrAWeights,
    tickerError,
  });

  const ctrA = ctrAOut.ctrA;
  const psiGrade = psiOut.grade;

  const ctrAReturnBias = Math.max(-0.05, Math.min(0.05, ctrA * 0.03));
  expectedReturn = expectedReturn + ctrAReturnBias;

  const stabilityBoost =
    0.85 + 0.15 * Math.min(1, Math.abs(ctrAOut.stability ?? 0.5));
  confidence = Math.min(
    1,
    Math.max(0, (confidence * 0.55 + psiGrade * 0.45) * stabilityBoost),
  );

  if (psiOut.signal === "buy" && signal === "neutral") signal = "buy";
  if (psiOut.signal === "sell" && signal === "neutral") signal = "sell";

  expectedReturn = Math.max(-0.15, Math.min(0.15, expectedReturn));

  const atrMult = Math.max(volatility, 0.008);
  const stopLoss =
    signal === "sell"
      ? entryPrice * (1 + 1.8 * atrMult)
      : entryPrice * (1 - 1.8 * atrMult);
  const takeProfit =
    signal === "sell"
      ? entryPrice * (1 - 2.5 * atrMult)
      : entryPrice * (1 + 2.5 * atrMult);

  const edge = Math.abs(expectedReturn) * confidence;
  const kellyPct = Math.max(0, Math.min(0.25, edge * 0.5));
  const predictedPrice = entryPrice * (1 + expectedReturn);

  const sentPart =
    sentimentMagnitude > 0
      ? ` | Sent: ${sentimentScore.toFixed(2)} (bias ${
        sentimentBias >= 0 ? "+" : ""
      }${(sentimentBias * 100).toFixed(2)}%)`
      : "";

  const errPart =
    Math.abs(tickerError) > 1e-6
      ? ` | e_t: ${tickerError.toFixed(4)} (corr ${
        ctrAOut.errorCorrection >= 0 ? "+" : ""
      }${ctrAOut.errorCorrection.toFixed(3)})`
      : "";

  // Snapshot for learning (uses pre-final expectedReturn bias components)
  const learningSnapshot = {
    psiComponents: psiOut.components,
    ctrAComponents: ctrAOut.components,
    expectedReturn,
    entryPrice,
    ticker,
  };

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
    sentimentScore,
    sentimentMagnitude,
    sentimentBias,
    tickerError,
    errorCorrection: ctrAOut.errorCorrection,
    learningSnapshot,
    rationale:
      `Regime: ${regime} | Ψ: ${psiOut.psi.toFixed(3)} | CTR-A: ${
        ctrAOut.ctrA.toFixed(3)
      } | Fractal Hurst: ${fractal.hurst.toFixed(3)}${sentPart}${errPart}`,
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
    sentimentScore: 0,
    sentimentMagnitude: 0,
    sentimentBias: 0,
    tickerError: 0,
    errorCorrection: 0,
    rationale,
    resolved: false,
    horizonEndDate: new Date(
      Date.now() + horizonDays * 86_400_000,
    ).toISOString(),
    createdAt: new Date().toISOString(),
  };
}
