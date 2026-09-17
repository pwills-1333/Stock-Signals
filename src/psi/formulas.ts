import { clamp } from "../stats.ts";

export interface PsiInputs {
  S: number;   // Sentiment [-1,1]
  E: number;   // Emotional intensity [0,1]
  C: number;   // Cognitive bias [0,1]
  M: number;   // Motivation [0,1]
  T: number;   // Thinking style [-1,1] (System1 vs System2 proxy)
  corr: number;
  vol: number;
}

export interface PsiWeights {
  ws: number;
  we: number;
  wc: number;
  wm: number;
  wt: number;
}

export const DEFAULT_PSI_WEIGHTS: PsiWeights = {
  ws: 0.30,
  we: 0.25,
  wc: 0.20,
  wm: 0.15,
  wt: 0.10,
};

/** Psych Bias Scalar */
export function psychBias(S: number, corr: number, vol: number): number {
  return S * corr * (1 + vol);
}

/** Core Ψ */
export function corePsi(inp: PsiInputs, w: PsiWeights): number {
  return w.ws * inp.S + w.we * inp.E + w.wc * inp.C + w.wm * inp.M;
}

/** Thinking-style extension */
export function extendedPsi(core: number, T: number, wt: number): number {
  return core + wt * T;
}

/** Unified Ψ_total */
export function psiTotal(psych: number, core: number, extended: number): number {
  return 0.35 * psych + 0.40 * core + 0.25 * extended;
}

/** Simple dynamic Ψ(t) with momentum + mean-reversion */
export function dynamicPsi(
  prev: number,
  current: number,
  error: number,
  coherence: number,
): number {
  const momentum = 0.65 * prev + 0.35 * current;
  const correction = -0.15 * error + 0.10 * coherence;
  return clamp(momentum + correction, -2, 2);
}

/** Ψ-driven drift */
export function psiDrift(psiTotal: number): number {
  return 0.15 * Math.tanh(psiTotal);
}

/** Ψ-driven volatility */
export function psiVolatility(baseVol: number, psiTotal: number): number {
  return baseVol * (1 + 0.6 * Math.abs(psiTotal));
}
