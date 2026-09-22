// backend/src/stats.ts

export function clamp(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return lo;
  return Math.min(Math.max(x, lo), hi);
}

export function sma(xs: number[], n: number): number {
  if (!Array.isArray(xs) || xs.length < n || n <= 0) return 0;
  let sum = 0;
  let count = 0;
  for (let i = xs.length - n; i < xs.length; i++) {
    const v = xs[i];
    if (Number.isFinite(v)) {
      sum += v;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b)) {
      out.push(Math.log(b / a));
    }
  }
  return out;
}

export function autocorrelation(xs: number[], lag: number): number {
  if (!Array.isArray(xs) || xs.length <= lag || lag <= 0) return 0;

  const mean =
    xs.reduce((a, b) => (Number.isFinite(b) ? a + b : a), 0) / xs.length;

  let num = 0;
  let den = 0;

  for (let i = 0; i < xs.length - lag; i++) {
    const a = xs[i];
    const b = xs[i + lag];
    if (Number.isFinite(a) && Number.isFinite(b)) {
      num += (a - mean) * (b - mean);
    }
  }

  for (const v of xs) {
    if (Number.isFinite(v)) {
      den += (v - mean) * (v - mean);
    }
  }

  return den === 0 ? 0 : num / den;
}

export function std(xs: number[]): number {
  if (!Array.isArray(xs) || xs.length < 2) return 0;

  const mean =
    xs.reduce((a, b) => (Number.isFinite(b) ? a + b : a), 0) / xs.length;

  let sum = 0;
  let count = 0;
  for (const v of xs) {
    if (Number.isFinite(v)) {
      sum += (v - mean) * (v - mean);
      count++;
    }
  }

  return count > 1 ? Math.sqrt(sum / (count - 1)) : 0;
}

export function percentile(sorted: number[], p: number): number {
  if (!Array.isArray(sorted) || sorted.length === 0) return 0;
  if (p <= 0) return sorted[0];
  if (p >= 1) return sorted[sorted.length - 1];

  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);

  if (lo === hi) return sorted[lo];

  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export function gauss(): number {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Approximate Wilder RSI
 */
export function rsi(closes: number[], period = 14): number {
  if (!Array.isArray(closes) || closes.length <= period) return 50;

  let avgGain = 0;
  let avgLoss = 0;

  // First average
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Proper MACD with real EMA series
 */
export function macd(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
) {
  if (!Array.isArray(closes) || closes.length < slowPeriod + signalPeriod) {
    return { macd: 0, signal: 0, hist: 0 };
  }

  const ema = (data: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const result: number[] = [];
    let prev = data[0];

    for (let i = 0; i < data.length; i++) {
      const val = Number.isFinite(data[i]) ? data[i] : prev;
      const current = i === 0 ? val : val * k + prev * (1 - k);
      result.push(current);
      prev = current;
    }
    return result;
  };

  const fastEMA = ema(closes, fastPeriod);
  const slowEMA = ema(closes, slowPeriod);

  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(fastEMA[i] - slowEMA[i]);
  }

  const signalLine = ema(macdLine, signalPeriod);
  const lastIdx = macdLine.length - 1;

  const macdVal = macdLine[lastIdx];
  const signalVal = signalLine[lastIdx];
  const hist = macdVal - signalVal;

  return {
    macd: Number.isFinite(macdVal) ? macdVal : 0,
    signal: Number.isFinite(signalVal) ? signalVal : 0,
    hist: Number.isFinite(hist) ? hist : 0,
  };
}

export function atr(
  h: number[],
  l: number[],
  c: number[],
  period = 14,
): number {
  if (
    !Array.isArray(h) ||
    !Array.isArray(l) ||
    !Array.isArray(c) ||
    h.length < period + 1
  ) {
    return 0;
  }

  const trs: number[] = [];

  for (let i = 1; i < h.length; i++) {
    const high = h[i];
    const low = l[i];
    const prevClose = c[i - 1];

    if (
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(prevClose)
    ) {
      continue;
    }

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose),
    );
    trs.push(tr);
  }

  if (trs.length < period) return 0;
  return sma(trs, period);
}

export function bollingerWidth(closes: number[], n = 20): number {
  if (!Array.isArray(closes) || closes.length < n) return 0;

  const slice = closes.slice(-n);
  const mean =
    slice.reduce((a, b) => (Number.isFinite(b) ? a + b : a), 0) /
    slice.length;

  let variance = 0;
  let count = 0;
  for (const v of slice) {
    if (Number.isFinite(v)) {
      variance += (v - mean) * (v - mean);
      count++;
    }
  }

  const stdDev = count > 0 ? Math.sqrt(variance / count) : 0;
  return stdDev / Math.max(mean, 1e-9);
}
