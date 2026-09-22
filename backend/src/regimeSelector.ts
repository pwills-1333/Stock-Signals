// backend/src/regimeSelector.ts
import type { Regime } from "./types.ts";

export interface RegimeInputs {
  expectedReturn: number;
  confidence: number;
  hurst: number;
  volatility: number;
  chaos: number;
  ctrA: number;
}

export interface HeadWeight {
  name: string;
  weight: number;
}

/**
 * Determine the dominant market regime
 */
export function detectRegime(inputs: RegimeInputs): Regime {
  const { expectedReturn, hurst, volatility, chaos, ctrA } = inputs;

  if (chaos > 0.45) return "chaos";
  if (volatility > 0.04) return "volatility"; // ATR/price > 4%

  if (hurst > 0.58 && expectedReturn > 0.005) return "trend";
  if (hurst < 0.42 && Math.abs(expectedReturn) > 0.004) return "meanReversion";

  if (ctrA > 0.18) return "fundamentalBull";
  if (ctrA < -0.18) return "fundamentalBear";

  return "neutral";
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
