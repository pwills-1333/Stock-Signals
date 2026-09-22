// backend/src/fractal.ts
import { clamp } from "./stats.ts";

export function computeFractalSignal(closes: number[]) {
  if (!Array.isArray(closes) || closes.length < 30) {
    return {
      hurst: 0.5,
      confidence: 0,
      trendBias: 0,
      chaos: true,
    };
  }

  // Use log returns for stability
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b)) {
      returns.push(Math.log(b / a));
    }
  }

  if (returns.length < 20) {
    return {
      hurst: 0.5,
      confidence: 0,
      trendBias: 0,
      chaos: true,
    };
  }

  // Simple variance-based Hurst approximation
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, x) => a + (x - mean) ** 2, 0) / returns.length;

  // Map variance into a Hurst-like value (0.05 – 0.95)
  // Higher variance → lower Hurst (more mean-reverting / chaotic)
  const hurst = clamp(0.5 - (variance - 0.0004) * 80, 0.05, 0.95);

  const confidence = clamp(Math.abs(hurst - 0.5) * 2.2, 0, 1);

  const trendBias =
    hurst > 0.58
      ? clamp((hurst - 0.58) * 4, 0, 1)
      : hurst < 0.42
      ? clamp((0.42 - hurst) * -4, -1, 0)
      : 0;

  const chaos = confidence < 0.22 || variance > 0.0015;

  return {
    hurst,
    confidence,
    trendBias,
    chaos,
  };
}
