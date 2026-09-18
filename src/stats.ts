export function clamp(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return lo;
  return Math.min(Math.max(x, lo), hi);
}

export function sma(xs: number[], n: number): number {
  if (!Array.isArray(xs) || xs.length < n || n <= 0) return 0;
  let sum = 0;
  for (let i = xs.length - n; i < xs.length; i++) {
    const v = xs[i];
    if (Number.isFinite(v)) sum += v;
  }
  return sum / n;
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

  for (let i = 0; i < xs.length; i++) {
    const v = xs[i];
    if (Number.isFinite(v)) {
      den += (v - mean) * (v - mean);
    }
  }

  if (den === 0) return 0;
  return num / den;
}

export function std(xs: number[]): number {
  if (!Array.isArray(xs) || xs.length < 2) return 0;

  const mean =
    xs.reduce((a, b) => (Number.isFinite(b) ? a + b : a), 0) / xs.length;

  let sum = 0;
  for (const v of xs) {
    if (Number.isFinite(v)) {
      sum += (v - mean) * (v - mean);
    }
  }

  return Math.sqrt(sum / (xs.length - 1));
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

export function rsi(closes: number[], period: number): number {
  if (!Array.isArray(closes) || closes.length <= period) return 0;

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (!Number.isFinite(diff)) continue;
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(closes: number[]) {
  if (!Array.isArray(closes) || closes.length < 35) {
    return { macd: 0, signal: 0, hist: 0 };
  }

  const ema = (arr: number[], span: number) => {
    const k = 2 / (span + 1);
    let v = arr[0];
    for (let i = 1; i < arr.length; i++) {
      const x = arr[i];
      if (Number.isFinite(x)) {
        v = x * k + v * (1 - k);
      }
    }
    return v;
  };

  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const macd = fast - slow;

  const signal = ema([macd], 9);
  const hist = macd - signal;

  return { macd, signal, hist };
}

export function atr(h: number[], l: number[], c: number[], period: number): number {
  if (
    !Array.isArray(h) ||
    !Array.isArray(l) ||
    !Array.isArray(c) ||
    h.length < period + 1 ||
    l.length < period + 1 ||
    c.length < period + 1
  ) {
    return 0;
  }

  const trs: number[] = [];

  for (let i = 1; i < h.length; i++) {
    const high = h[i];
    const low = l[i];
    const prevClose = c[i - 1];

    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(prevClose)) {
      continue;
    }

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    trs.push(tr);
  }

  if (trs.length < period) return 0;

  return sma(trs, period);
}

export function bollingerWidth(closes: number[], n: number): number {
  if (!Array.isArray(closes) || closes.length < n) return 0;

  const slice = closes.slice(-n);
  const mean =
    slice.reduce((a, b) => (Number.isFinite(b) ? a + b : a), 0) / slice.length;

  let variance = 0;
  for (const v of slice) {
    if (Number.isFinite(v)) {
      variance += (v - mean) * (v - mean);
    }
  }

  const std = Math.sqrt(variance / slice.length);
  return std / Math.max(mean, 1);
}
