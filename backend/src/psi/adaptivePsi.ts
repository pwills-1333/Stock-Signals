// backend/src/psi/adaptivePsi.ts
import { computeFractalSignal } from "../fractal.ts";
import {
  psiReturn,
  psiConfidence,
  psiVolatility,
  psiTrend,
  psiChaos,
  psiComposite,
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
  /** optional preloaded weights (avoids extra IO in pipeline) */
  weights?: PsiWeights;
}

export interface PsiOutput {
  psi: number;
  grade: number;
  signal: string;
  hurst: number;
  trendBias: number;
  chaos: boolean;
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

  const r = psiReturn(expectedReturn);
  const c = psiConfidence(confidence);
  const v = psiVolatility(volatility);
  const t = psiTrend(fractal.trendBias);
  const ch = psiChaos(fractal.chaos);

  const psi = psiComposite(
    {
      expectedReturn: r,
      confidence: c,
      volatility: v,
      trendBias: t,
      chaos: fractal.chaos,
    },
    weights,
  );

  return {
    psi,
    grade: psiGrade(psi),
    signal: psiSignal(psi),
    hurst: fractal.hurst,
    trendBias: fractal.trendBias,
    chaos: fractal.chaos,
    components: { r, c, v, t, ch },
  };
}
