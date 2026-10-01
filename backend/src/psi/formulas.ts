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

export function psiChaos(chaos: boolean): number {
  return chaos ? 0 : 1;
}

export function psiComposite(
  params: {
    expectedReturn: number;
    confidence: number;
    volatility: number;
    trendBias: number;
    chaos: boolean;
  },
  weights: PsiWeights = DEFAULT_PSI_WEIGHTS,
): number {
  const r = psiReturn(params.expectedReturn);
  const c = psiConfidence(params.confidence);
  const v = psiVolatility(params.volatility);
  const t = psiTrend(params.trendBias);
  const ch = psiChaos(params.chaos);

  const score =
    r * weights.r +
    c * weights.c +
    v * weights.v +
    t * weights.t +
    ch * weights.ch;

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
