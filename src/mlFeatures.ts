import { mean, stddev } from "./stats.ts";
import { OHLC } from "./types.ts";

export function buildFeatures(ohlc: OHLC[]): number[] {
  if (!Array.isArray(ohlc) || ohlc.length < 2) {
    return Array(20).fill(0);
  }

  const closes = ohlc.map((x) => x.c).filter(Number.isFinite);
  const volumes = ohlc.map((x) => x.v).filter(Number.isFinite);

  const n = closes.length;
  if (n < 2) return Array(20).fill(0);

  const returns: number[] = [];
  for (let i = 1; i < n; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev > 0 && Number.isFinite(curr)) {
      returns.push((curr - prev) / prev);
    }
  }

  const last = closes[n - 1];
  const first = closes[0];

  const momentum = last - first;
  const volumeTrend = volumes[n - 1] - volumes[0];

  const ret1 = returns[n - 2] ?? 0;
  const ret5 = returns[n - 6] ?? 0;
  const ret10 = returns[n - 11] ?? 0;
  const ret20 = returns[n - 21] ?? 0;

  const vol20Slice = returns.slice(-20);
  const vol20 =
    vol20Slice.length >= 5 ? stddev(vol20Slice) : stddev(returns);

  const returnMean = mean(returns);
  const returnStd = stddev(returns);

  const norm = (x: number) => (Number.isFinite(x) ? x : 0);

  return [
    norm(momentum / Math.max(first, 1)),
    norm(volumeTrend / Math.max(volumes[0], 1)),
    norm(returnMean),
    norm(returnStd),
    norm(vol20),
    norm(ret1),
    norm(ret5),
    norm(ret10),
    norm(ret20),
    norm(last),
    norm(first),
    norm(last / Math.max(first, 1)),
    norm(closes[n - 1] - closes[n - 2] || 0),
    norm(closes[n - 1] / Math.max(closes[n - 2], 1)),
    norm(volumes[n - 1] / Math.max(volumes[n - 2], 1)),
    norm(returns.length),
    norm(mean(volumes)),
    norm(stddev(volumes)),
    norm(closes[n - 1]),
    norm(volumes[n - 1])
  ];
}
import { mean, stddev } from "./stats.ts";
import { OHLC } from "./types.ts";

export function buildFeatures(ohlc: OHLC[]): number[] {
  if (!Array.isArray(ohlc) || ohlc.length < 2) {
    return Array(20).fill(0);
  }

  const closes = ohlc.map((x) => x.c).filter(Number.isFinite);
  const volumes = ohlc.map((x) => x.v).filter(Number.isFinite);

  const n = closes.length;
  if (n < 2) return Array(20).fill(0);

  const returns: number[] = [];
  for (let i = 1; i < n; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev > 0 && Number.isFinite(curr)) {
      returns.push((curr - prev) / prev);
    }
  }

  const last = closes[n - 1];
  const first = closes[0];

  const momentum = last - first;
  const volumeTrend = volumes[n - 1] - volumes[0];

  const ret1 = returns[n - 2] ?? 0;
  const ret5 = returns[n - 6] ?? 0;
  const ret10 = returns[n - 11] ?? 0;
  const ret20 = returns[n - 21] ?? 0;

  const vol20Slice = returns.slice(-20);
  const vol20 =
    vol20Slice.length >= 5 ? stddev(vol20Slice) : stddev(returns);

  const returnMean = mean(returns);
  const returnStd = stddev(returns);

  const norm = (x: number) => (Number.isFinite(x) ? x : 0);

  return [
    norm(momentum / Math.max(first, 1)),
    norm(volumeTrend / Math.max(volumes[0], 1)),
    norm(returnMean),
    norm(returnStd),
    norm(vol20),
    norm(ret1),
    norm(ret5),
    norm(ret10),
    norm(ret20),
    norm(last),
    norm(first),
    norm(last / Math.max(first, 1)),
    norm(closes[n - 1] - closes[n - 2] || 0),
    norm(closes[n - 1] / Math.max(closes[n - 2], 1)),
    norm(volumes[n - 1] / Math.max(volumes[n - 2], 1)),
    norm(returns.length),
    norm(mean(volumes)),
    norm(stddev(volumes)),
    norm(closes[n - 1]),
    norm(volumes[n - 1])
  ];
}
