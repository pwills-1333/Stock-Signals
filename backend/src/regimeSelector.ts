// backend/src/regimeSelector.ts
import type { Regime } from "./types.ts";

export interface RegimeInputs {
  expectedReturn: number;
  confidence: number;
  hurst: number;
  volatility: number;
  /** Continuous chaos score in [0, 1] */
  chaos: number;
  ctrA: number;
}

export interface HeadWeight {
  name: string;
  weight: number;
}

/**
 * Rank regimes instead of first-match hard gates.
 * Chaos only wins when it is clearly dominant.
 */
export function detectRegime(inputs: RegimeInputs): Regime {
  const { expectedReturn, hurst, volatility, chaos, ctrA } = inputs;

  const scores: Record<Regime, number> = {
    chaos: 0,
    volatility: 0,
    trend: 0,
    meanReversion: 0,
    fundamentalBull: 0,
    fundamentalBear: 0,
    neutral: 0.15, // small baseline so quiet markets stay neutral
  };

  // Chaos: needs high continuous score (was: any > 0.45 → always chaos)
  if (chaos >= 0.55) {
    scores.chaos = 0.4 + (chaos - 0.55) * 1.2;
  }
  if (chaos >= 0.75) {
    scores.chaos += 0.35; // strong boost only for extreme chaos
  }

  // Volatility regime (ATR/price)
  if (volatility > 0.035) {
    scores.volatility = 0.35 + Math.min(0.5, (volatility - 0.035) * 12);
  }

  // Trend: persistent Hurst + directional return
  if (hurst > 0.55 && expectedReturn > 0.003) {
    scores.trend =
      0.3 +
      Math.min(0.45, (hurst - 0.55) * 3) +
      Math.min(0.25, expectedReturn * 8);
  }

  // Mean reversion: low Hurst + meaningful move
  if (hurst < 0.45 && Math.abs(expectedReturn) > 0.003) {
    scores.meanReversion =
      0.3 +
      Math.min(0.45, (0.45 - hurst) * 3) +
      Math.min(0.25, Math.abs(expectedReturn) * 8);
  }

  // Sentiment / structure tilt (ctrA used as proxy at detect time)
  if (ctrA > 0.15) {
    scores.fundamentalBull = 0.25 + Math.min(0.5, (ctrA - 0.15) * 2);
  }
  if (ctrA < -0.15) {
    scores.fundamentalBear = 0.25 + Math.min(0.5, (-ctrA - 0.15) * 2);
  }

  // If chaos is only moderate, suppress it so structure can win
  if (chaos < 0.55) {
    scores.chaos = 0;
  }

  let best: Regime = "neutral";
  let bestScore = -1;
  for (const [name, score] of Object.entries(scores) as [Regime, number][]) {
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  return best;
}

/**
 * Assign weights to heads based on the detected regime
 */
export function weightHeadsByRegime(
  regime: Regime,
  heads: { name: string }[],
): HeadWeight[] {
  const weights: HeadWeight[] = [];

  for (const head of heads) {
    let w = 1.0;
    const name = (head.name || "").toLowerCase();

    switch (regime) {
      case "trend":
        if (name.includes("trend")) w = 1.45;
        else if (name.includes("meanrev")) w = 0.55;
        else if (name.includes("chaos") || name.includes("vol")) w = 0.75;
        break;

      case "meanReversion":
        if (name.includes("meanrev")) w = 1.50;
        else if (name.includes("trend")) w = 0.50;
        else if (name.includes("chaos")) w = 0.70;
        break;

      case "chaos":
        if (name.includes("chaos")) w = 1.60;
        else if (name.includes("vol")) w = 1.25;
        else w = 0.45;
        break;

      case "volatility":
        if (name.includes("vol") || name.includes("volatility")) w = 1.45;
        else if (name.includes("chaos")) w = 1.15;
        else w = 0.80;
        break;

      case "fundamentalBull":
        if (name.includes("trend")) w = 1.30;
        else if (name.includes("meanrev")) w = 0.70;
        break;

      case "fundamentalBear":
        if (name.includes("meanrev")) w = 1.30;
        else if (name.includes("trend")) w = 0.70;
        break;

      case "neutral":
      default:
        w = 1.0;
        break;
    }

    weights.push({ name: head.name, weight: w });
  }

  return weights;
}

/**
 * Apply the regime weights to head outputs
 */
export function applyHeadWeights(
  headOutputs: { name: string; output: number }[],
  weights: HeadWeight[],
): { name: string; output: number }[] {
  return headOutputs.map((head) => {
    const w = weights.find((x) => x.name === head.name)?.weight ?? 1.0;
    return {
      name: head.name,
      output: head.output * w,
    };
  });
}
