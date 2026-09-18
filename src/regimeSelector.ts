/**
 * Regime Selector for Multi‑Artifact Head Weighting
 * -------------------------------------------------
 * This module analyzes market conditions (trend, chaos, volatility,
 * psi, ctrA, hurst) and returns dynamic multipliers for each head.
 *
 * Your pipeline can use these weights to amplify or dampen head outputs.
 */

export interface RegimeInputs {
  expectedReturn: number;   // from aggregateHeads
  confidence: number;       // psi proxy
  hurst: number;            // fractal.ts
  volatility: number;       // ATR or GARCH (future)
  chaos: number;            // chaos detector head output
  ctrA: number;             // ctrA.ts
}

export interface HeadWeight {
  name: string;
  weight: number;
}

/**
 * Determine the dominant market regime.
 */
export function detectRegime(inputs: RegimeInputs): string {
  const { expectedReturn, hurst, volatility, chaos, ctrA } = inputs;

  if (chaos > 0.4) return "chaos";
  if (volatility > 0.35) return "volatility";
  if (hurst > 0.55 && expectedReturn > 0) return "trend";
  if (hurst < 0.45 && expectedReturn < 0) return "meanReversion";
  if (ctrA < -0.2) return "fundamentalBear";
  if (ctrA > 0.2) return "fundamentalBull";

  return "neutral";
}

/**
 * Assign weights to heads based on regime.
 */
export function weightHeadsByRegime(
  regime: string,
  heads: { name: string }[]
): HeadWeight[] {
  const weights: HeadWeight[] = [];

  for (const head of heads) {
    let w = 1.0;

    const name = head.name.toLowerCase();

    // Trend regime
    if (regime === "trend") {
      if (name.includes("trend")) w = 1.4;
      if (name.includes("meanrev")) w = 0.6;
      if (name.includes("chaos")) w = 0.8;
    }

    // Mean reversion regime
    if (regime === "meanreversion") {
      if (name.includes("meanrev")) w = 1.5;
      if (name.includes("trend")) w = 0.5;
      if (name.includes("chaos")) w = 0.7;
    }

    // Chaos regime
    if (regime === "chaos") {
      if (name.includes("chaos")) w = 1.6;
      if (name.includes("trend")) w = 0.4;
      if (name.includes("meanrev")) w = 0.4;
      if (name.includes("volatility")) w = 1.2;
    }

    // Volatility regime
    if (regime === "volatility") {
      if (name.includes("volatility")) w = 1.5;
      if (name.includes("trend")) w = 0.8;
      if (name.includes("meanrev")) w = 0.8;
      if (name.includes("chaos")) w = 1.1;
    }

    // Fundamental bull
    if (regime === "fundamentalbull") {
      if (name.includes("trend")) w = 1.3;
      if (name.includes("meanrev")) w = 0.7;
    }

    // Fundamental bear
    if (regime === "fundamentalbear") {
      if (name.includes("meanrev")) w = 1.3;
      if (name.includes("trend")) w = 0.7;
    }

    // Neutral regime
    if (regime === "neutral") {
      w = 1.0;
    }

    weights.push({ name: head.name, weight: w });
  }

  return weights;
}

/**
 * Apply weights to head outputs.
 */
export function applyHeadWeights(
  headOutputs: { name: string; output: number }[],
  weights: HeadWeight[]
) {
  const weighted = [];

  for (const head of headOutputs) {
    const w = weights.find((x) => x.name === head.name)?.weight ?? 1.0;
    weighted.push({
      name: head.name,
      output: head.output * w
    });
  }

  return weighted;
}
