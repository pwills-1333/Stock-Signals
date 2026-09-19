import { clamp } from "./stats.ts";

export function computeFractalSignal(closes: number[]) {
  if (!Array.isArray(closes) || closes.length < 20) {
    return {
      hurst: 0.5,
      confidence: 0,
      trendBias: 0,
      chaos: true
    };
  }

  const diffs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b)) {
      diffs.push(Math.abs(Math.log(b / a)));
    }
  }

  if (diffs.length < 10) {
    return {
      hurst: 0.5,
      confidence: 0,
      trendBias: 0,
      chaos: true
    };
  }

  const mean =
    diffs.reduce((a, b) => a + b, 0) / diffs.length;

  const variance =
    diffs.reduce((a, x) => a + (x - mean) ** 2, 0) / diffs.length;

  const hurst = clamp(0.5 + (variance - mean) * 2, 0.05, 0.95);
  const confidence = clamp(Math.abs(hurst - 0.5) * 2, 0, 1);

  const trendBias =
    hurst > 0.55
      ? clamp((hurst - 0.55) * 3, 0, 1)
      : hurst < 0.45
      ? clamp((0.45 - hurst) * -3, -1, 0)
      : 0;

  const chaos = confidence < 0.25;

  return {
    hurst,
    confidence,
    trendBias,
    chaos
  };
}
