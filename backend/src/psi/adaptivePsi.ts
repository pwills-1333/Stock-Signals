// backend/src/psi/adaptivePsi.ts
import { computeFractalSignal } from "../fractal.ts";
import {
  psiReturn,
  psiConfidence,
  psiVolatility,
  psiTrend,
  psiChaos,
  psiCompositeFromComponents,
  psiGrade,
  psiSignal,
} from "./formulas.ts";
import { getPsiWeights } from "../learning/state.ts";
import type { PsiWeights } from "../learning/types.ts";

export interface PsiInputs {
  expectedReturn: number;
  confidence: number;
  volatility: number;
  closes: number[];
  weights?: PsiWeights;
}

export interface PsiOutput {
  psi: number;
  grade: number;
  signal: string;
  hurst: number;
  trendBias: number;
  /** Continuous chaos score [0,1] (or legacy boolean coerced) */
  chaos: number;
  components: {
    r: number;
    c: number;
    v: number;
    t: number;
    ch: number;
  };
}

export async function computeAdaptivePsi(
  input: PsiInputs,
): Promise<PsiOutput> {
  const { expectedReturn, confidence, volatility, closes } = input;
  const weights = input.weights ?? (await getPsiWeights());

  const fractal = computeFractalSignal(closes);

  const chaosScore =
    typeof fractal.chaos === "number"
      ? Math.max(0, Math.min(1, fractal.chaos))
      : fractal.chaos
      ? 0.6
      : 0.1;

  // Transform once
  const r = psiReturn(expectedReturn);
  const c = psiConfidence(confidence);
  const v = psiVolatility(volatility);
  const t = psiTrend(fractal.trendBias);
  const ch = psiChaos(chaosScore);

  // Weighted sum only — no second transform
  const psi = psiCompositeFromComponents({ r, c, v, t, ch }, weights);

  return {
    psi,
    grade: psiGrade(psi),
    signal: psiSignal(psi),
    hurst: fractal.hurst,
    trendBias: fractal.trendBias,
    chaos: chaosScore,
    components: { r, c, v, t, ch },
  };
}
