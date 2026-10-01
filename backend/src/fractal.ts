// backend/src/fractal.ts
import { clamp } from "./stats.ts";

/**
 * Lightweight fractal / Hurst proxy on log returns.
 * chaos is a continuous score in [0, 1] — not a hard boolean gate.
 */
export function computeFractalSignal(closes: number[]) {
  if (!Array.isArray(closes) || closes.length < 30) {
    return {
      hurst: 0.5,
      confidence: 0,
      trendBias: 0,
      chaos: 0.35, // mild uncertainty when short sample — not forced chaos regime
      chaosFlag: false,
      variance: 0,
    };
  }

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
      chaos: 0.35,
      chaosFlag: false,
      variance: 0,
    };
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, x) => a + (x - mean) ** 2, 0) / returns.length;

  // Higher variance → lower Hurst (more noise / mean-reverting)
  const hurst = clamp(0.5 - (variance - 0.0004) * 80, 0.05, 0.95);

  // How far Hurst is from pure random walk
  const confidence = clamp(Math.abs(hurst - 0.5) * 2.2, 0, 1);

  const trendBias =
    hurst > 0.58
      ? clamp((hurst - 0.58) * 4, 0, 1)
      : hurst < 0.42
      ? clamp((0.42 - hurst) * -4, -1, 0)
      : 0;

  // Continuous chaos score (0 = ordered, 1 = highly chaotic)
  // - Near H=0.5 contributes modest chaos
  // - Elevated variance contributes more
  const nearRandom = clamp(1 - confidence, 0, 1); // 1 when H≈0.5
  const varChaos = clamp((variance - 0.0008) / 0.004, 0, 1); // ramps after ~2.8% daily vol
  const chaos = clamp(0.25 * nearRandom + 0.75 * varChaos, 0, 1);

  // Soft flag for diagnostics only (not used as a hard regime gate)
  const chaosFlag = chaos >= 0.55 && variance > 0.0025;

  return {
    hurst,
    confidence,
    trendBias,
    chaos,
    chaosFlag,
    variance,
  };
}
