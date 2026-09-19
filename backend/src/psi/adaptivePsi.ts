import { clamp } from "../stats.ts";
import { computeFractalSignal } from "../fractal.ts";
import {
  psiReturn,
  psiConfidence,
  psiVolatility,
  psiTrend,
  psiChaos,
  psiComposite,
  psiGrade,
  psiSignal
} from "./formulas.ts";

export interface PsiInputs {
  expectedReturn: number;
  confidence: number;
  volatility: number;
  closes: number[];
}

export interface PsiOutput {
  psi: number;
  grade: number;
  signal: string;
  hurst: number;
  trendBias: number;
  chaos: boolean;
}

export function computeAdaptivePsi(input: PsiInputs): PsiOutput {
  const { expectedReturn, confidence, volatility, closes } = input;

  const fractal = computeFractalSignal(closes);

  const r = psiReturn(expectedReturn);
  const c = psiConfidence(confidence);
  const v = psiVolatility(volatility);
  const t = psiTrend(fractal.trendBias);
  const ch = psiChaos(fractal.chaos);

  const psi = psiComposite({
    expectedReturn: r,
    confidence: c,
    volatility: v,
    trendBias: t,
    chaos: fractal.chaos
  });

  const grade = psiGrade(psi);
  const signal = psiSignal(psi);

  return {
    psi,
    grade,
    signal,
    hurst: fractal.hurst,
    trendBias: fractal.trendBias,
    chaos: fractal.chaos
  };
}

export function integratePsiIntoPrediction(pred: any): any {
  if (!pred || !Array.isArray(pred.closes)) return pred;

  const psiOut = computeAdaptivePsi({
    expectedReturn: pred.expectedReturn ?? 0,
    confidence: pred.confidence ?? 0,
    volatility: pred.volatility ?? 0,
    closes: pred.closes
  });

  return {
    ...pred,
    psi: psiOut.psi,
    tradeGrade: psiOut.grade,
    signal: psiOut.signal,
    hurst: psiOut.hurst,
    trendBias: psiOut.trendBias,
    chaos: psiOut.chaos
  };
}
