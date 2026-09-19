import { clamp } from "../stats.ts";
import { computeFractalSignal } from "../fractal.ts";

export interface CtrAInput {
  closes: number[];
  expectedReturn: number;
  confidence: number;
  psi: number;
}

export interface CtrAOutput {
  ctrA: number;
  temporalBias: number;
  recursiveBias: number;
  fractalBias: number;
  stability: number;
}

function temporalComponent(closes: number[]): number {
  if (!Array.isArray(closes) || closes.length < 10) return 0;

  const n = closes.length;
  const last = closes[n - 1];
  const prev = closes[n - 2];

  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev <= 0) return 0;

  const ret = (last - prev) / prev;
  return clamp(ret * 2, -1, 1);
}

function recursiveComponent(expectedReturn: number, confidence: number): number {
  if (!Number.isFinite(expectedReturn) || !Number.isFinite(confidence)) return 0;

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
      const diff = Math.abs(Math.log(b / a));
      sum += diff;
      count++;
    }
  }

  if (count === 0) return 0.5;

  const avg = sum / count;
  return clamp(1 / (1 + avg * 10), 0, 1);
}

export function computeCtrA(input: CtrAInput): CtrAOutput {
  const { closes, expectedReturn, confidence, psi } = input;

  const temporalBias = temporalComponent(closes);
  const recursiveBias = recursiveComponent(expectedReturn, confidence);
  const fractalBias = fractalComponent(closes);
  const stability = stabilityScore(closes);

  const ctrA =
    temporalBias * 0.25 +
    recursiveBias * 0.35 +
    fractalBias * 0.25 +
    clamp(psi, -1, 1) * 0.15;

  return {
    ctrA: clamp(ctrA, -1, 1),
    temporalBias,
    recursiveBias,
    fractalBias,
    stability
  };
}
