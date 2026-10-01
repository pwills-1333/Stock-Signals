// backend/src/psi/formulas.ts
import { clamp } from "../stats.ts";
import type { PsiWeights } from "../learning/types.ts";
import { DEFAULT_PSI_WEIGHTS } from "../learning/state.ts";

export function psiReturn(expectedReturn: number): number {
  if (!Number.isFinite(expectedReturn)) return 0;
  return clamp(expectedReturn, -1, 1);
}

export function psiConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0;
  return clamp(confidence, 0, 1);
}

export function psiVolatility(vol: number): number {
  if (!Number.isFinite(vol) || vol <= 0) return 0;
  return clamp(1 / (1 + vol), 0, 1);
}

export function psiTrend(trendBias: number): number {
  if (!Number.isFinite(trendBias)) return 0;
  return clamp(trendBias, -1, 1);
}

/**
 * Chaos contribution for Ψ.
 * Accepts continuous score [0,1] or legacy boolean.
 * High chaos → low contribution (penalizes order component).
 */
export function psiChaos(chaos: number | boolean): number {
  if (typeof chaos === "boolean") {
    return chaos ? 0 : 1;
  }
  if (!Number.isFinite(chaos)) return 0.5;
  // chaos 0 → 1 (ordered), chaos 1 → 0 (fully chaotic)
  return clamp(1 - chaos, 0, 1);
}

/**
 * From raw pipeline inputs (transforms, then weights).
 */
export function psiComposite(
  params: {
    expectedReturn: number;
    confidence: number;
    volatility: number;
    trendBias: number;
    chaos: number | boolean;
  },
  weights: PsiWeights = DEFAULT_PSI_WEIGHTS,
): number {
  const r = psiReturn(params.expectedReturn);
  const c = psiConfidence(params.confidence);
  const v = psiVolatility(params.volatility);
  const t = psiTrend(params.trendBias);
  const ch = psiChaos(params.chaos);
  return psiCompositeFromComponents({ r, c, v, t, ch }, weights);
}

/**
 * Weighted sum only — components must already be transformed.
 * Use this when adaptivePsi has already applied psiReturn / etc.
 */
export function psiCompositeFromComponents(
  components: {
    r: number;
    c: number;
    v: number;
    t: number;
    ch: number;
  },
  weights: PsiWeights = DEFAULT_PSI_WEIGHTS,
): number {
  const score =
    components.r * weights.r +
    components.c * weights.c +
    components.v * weights.v +
    components.t * weights.t +
    components.ch * weights.ch;

  return clamp(score, -1, 1);
}

export function psiGrade(psi: number): number {
  if (!Number.isFinite(psi)) return 0;
  return clamp((psi + 1) / 2, 0, 1);
}

export function psiSignal(psi: number): string {
  if (!Number.isFinite(psi)) return "neutral";
  if (psi > 0.25) return "buy";
  if (psi < -0.25) return "sell";
  return "neutral";
}
