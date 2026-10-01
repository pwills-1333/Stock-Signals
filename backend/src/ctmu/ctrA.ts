// backend/src/ctmu/ctrA.ts
import { clamp } from "../stats.ts";
import { computeFractalSignal } from "../fractal.ts";
import { getCtrAWeights, getTickerError } from "../learning/state.ts";
import { ERROR_CORRECTION_ALPHA } from "../learning/update.ts";
import type { CtrAWeights } from "../learning/types.ts";
import { DEFAULT_CTRA_WEIGHTS } from "../learning/state.ts";

export interface CtrAInput {
  closes: number[];
  expectedReturn: number;
  confidence: number;
  psi: number;
  ticker?: string;
  weights?: CtrAWeights;
  /** per-ticker recursive error; if omitted, loaded from state when ticker set */
  tickerError?: number;
}

export interface CtrAOutput {
  ctrA: number;
  temporalBias: number;
  recursiveBias: number;
  fractalBias: number;
  stability: number;
  errorCorrection: number;
  components: {
    temporal: number;
    recursive: number;
    fractal: number;
    psi: number;
  };
}

function temporalComponent(closes: number[]): number {
  if (!Array.isArray(closes) || closes.length < 10) return 0;
  const n = closes.length;
  const last = closes[n - 1];
  const prev = closes[n - 2];
  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev <= 0) return 0;
  return clamp(((last - prev) / prev) * 2, -1, 1);
}

function recursiveComponent(
  expectedReturn: number,
  confidence: number,
): number {
  if (!Number.isFinite(expectedReturn) || !Number.isFinite(confidence)) {
    return 0;
  }
  const r = clamp(expectedReturn, -1, 1);
  const c = clamp(confidence, 0, 1);
  return clamp(r * c * 1.5, -1, 1);
}

function fractalComponent(closes: number[]): number {
  const f = computeFractalSignal(closes);
  return clamp(f.trendBias, -1, 1);
}

function stabilityScore(closes: number[]): number {
  if (!Array.isArray(closes) || closes.length < 20) return 0.5;
  let sum = 0;
  let count = 0;
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b)) {
      sum += Math.abs(Math.log(b / a));
      count++;
    }
  }
  if (count === 0) return 0.5;
  return clamp(1 / (1 + (sum / count) * 10), 0, 1);
}

export async function computeCtrA(input: CtrAInput): Promise<CtrAOutput> {
  const { closes, expectedReturn, confidence, psi } = input;
  const weights = input.weights ?? (await getCtrAWeights());

  let e = input.tickerError;
  if (e === undefined && input.ticker) {
    e = await getTickerError(input.ticker);
  }
  e = e ?? 0;

  const temporalBias = temporalComponent(closes);
  const recursiveBias = recursiveComponent(expectedReturn, confidence);
  const fractalBias = fractalComponent(closes);
  const stability = stabilityScore(closes);
  const psiClamped = clamp(psi, -1, 1);

  const w = weights ?? DEFAULT_CTRA_WEIGHTS;
  let ctrA =
    temporalBias * w.temporal +
    recursiveBias * w.recursive +
    fractalBias * w.fractal +
    psiClamped * w.psi;

  // Recursive correction: if we over-predicted before, pull ctrA down
  const errorCorrection = clamp(
    -ERROR_CORRECTION_ALPHA * Math.tanh(e / 0.05),
    -0.12,
    0.12,
  );
  ctrA = clamp(ctrA + errorCorrection, -1, 1);

  return {
    ctrA,
    temporalBias,
    recursiveBias,
    fractalBias,
    stability,
    errorCorrection,
    components: {
      temporal: temporalBias,
      recursive: recursiveBias,
      fractal: fractalBias,
      psi: psiClamped,
    },
  };
}
