import { clamp, sma, logReturns, std, autocorrelation } from "./stats.ts";
import { extractFeatures } from "./mlFeatures.ts";
import { predictWithArtifact } from "./trainedModels.ts";
import type { OHLC, Weights } from "./types.ts";

export function runEnsemble(
  ohlc: OHLC,
  sentimentS: number,
  weights: Weights,
  artifact: any | null,
) {
  const feats = extractFeatures(ohlc, sentimentS);
  if (!feats) {
    return { yhat: 0, components: {}, quality: 0.2 };
  }

  const featureVec = [
    feats.rsi, feats.macdHist, feats.smaSpread20_50, feats.smaSpread50_200,
    feats.mom5, feats.mom10, feats.mom20, feats.vol20, feats.volRatio,
    feats.sentiment, feats.volumeRatio, feats.hurst, feats.ret1, feats.ret5,
  ];

  // Heuristic heads
  const markov = clamp(feats.mom5 * 0.6 + feats.ret1 * 0.4, -0.15, 0.15);
  const arimaLstm = clamp(feats.mom10 * 0.5 + (0.5 - feats.rsi) * 0.08, -0.12, 0.12);
  const lstm = clamp(feats.mom20 * 0.4 + feats.macdHist * 8, -0.12, 0.12);
  const xgb = clamp(feats.smaSpread20_50 * 1.2 + feats.sentiment * 0.04, -0.1, 0.1);
  const rf = clamp((feats.hurst - 0.5) * 0.15 + feats.volumeRatio * 0.03, -0.08, 0.08);

  let components: Record<string, number> = {
    markov, arimaLstm, lstm, xgb, rf,
  };

  // Override with trained ridge if available
  if (artifact) {
    const trained = predictWithArtifact(artifact, featureVec);
    components = {
      markov: trained * 0.9,
      arimaLstm: trained,
      lstm: trained * 1.05,
      xgb: trained * 0.95,
      rf: trained * 0.85,
    };
  }

  const yhat =
    weights.markov * components.markov +
    weights.arimaLstm * components.arimaLstm +
    weights.lstm * components.lstm +
    weights.xgb * components.xgb +
    weights.rf * components.rf;

  const quality = clamp(0.45 + Math.abs(yhat) * 3 + (artifact ? 0.15 : 0), 0.2, 0.95);

  return { yhat, components, quality, features: feats };
}
