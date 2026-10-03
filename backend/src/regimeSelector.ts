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
 * Tuned so TSLA-like high ATR does not always win "volatility".
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
    neutral: 0.22, // higher baseline → more neutral in quiet/ambiguous markets
  };

  // Chaos: only when clearly dominant
  if (chaos >= 0.60) {
    scores.chaos = 0.35 + (chaos - 0.60) * 1.1;
  }
  if (chaos >= 0.80) {
    scores.chaos += 0.30;
  }

  // Volatility: raised floor (was 0.035) so moderate TSLA vol does not dominate
  if (volatility > 0.055) {
    scores.volatility = 0.28 + Math.min(0.45, (volatility - 0.055) * 8);
  } else if (volatility > 0.040) {
    // mild vol contributes less
    scores.volatility = 0.12 + (volatility - 0.040) * 4;
  }

  // Trend: persistent Hurst + directional return
  if (hurst > 0.55 && Math.abs(expectedReturn) > 0.004) {
    const dirBoost =
      expectedReturn > 0
        ? Math.min(0.25, expectedReturn * 8)
        : Math.min(0.25, -expectedReturn * 6);
    scores.trend =
      0.28 +
      Math.min(0.45, (hurst - 0.55) * 3) +
      dirBoost;
  }

  // Mean reversion: low Hurst OR high vol + weak trend (TSLA-friendly)
  if (hurst < 0.48 && Math.abs(expectedReturn) > 0.003) {
    scores.meanReversion =
      0.32 +
      Math.min(0.45, (0.48 - hurst) * 3) +
      Math.min(0.25, Math.abs(expectedReturn) * 8);
  }
  // Extra mean-rev path when vol is elevated but not extreme chaos
  if (volatility > 0.045 && hurst < 0.52 && chaos < 0.65) {
    scores.meanReversion = Math.max(
      scores.meanReversion,
      0.30 + Math.min(0.35, (volatility - 0.045) * 6),
    );
  }

  // Sentiment / structure tilt
  if (ctrA > 0.18) {
    scores.fundamentalBull = 0.22 + Math.min(0.45, (ctrA - 0.18) * 1.8);
  }
  if (ctrA < -0.18) {
    scores.fundamentalBear = 0.22 + Math.min(0.45, (-ctrA - 0.18) * 1.8);
  }

  if (chaos < 0.60) {
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

  // Require clear winner over neutral
  if (best !== "neutral" && bestScore < scores.neutral + 0.08) {
    return "neutral";
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
        if (name.includes("meanrev")) w = 1.55;
        else if (name.includes("trend")) w = 0.45;
        else if (name.includes("chaos") || name.includes("vol")) w = 1.05;
        break;

      case "chaos":
        if (name.includes("chaos")) w = 1.60;
        else if (name.includes("vol")) w = 1.25;
        else w = 0.45;
        break;

      case "volatility":
        // Prefer mean-rev / vol heads; de-emphasize pure trend (TSLA buy bias)
        if (name.includes("meanrev")) w = 1.40;
        else if (name.includes("vol") || name.includes("volatility")) w = 1.35;
        else if (name.includes("chaos")) w = 1.15;
        else if (name.includes("trend")) w = 0.55;
        else w = 0.85;
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
        // Slight mean-rev lean in neutral (avoid always-long ensemble)
        if (name.includes("meanrev")) w = 1.10;
        else if (name.includes("trend")) w = 0.90;
        else w = 1.0;
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
