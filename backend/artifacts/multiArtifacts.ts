// backend/src/mlFeatures.ts
import type { OHLC } from "./types.ts";
import {
  sma,
  logReturns,
  autocorrelation,
  std,
  rsi,
  macd,
  atr,
  bollingerWidth,
  clamp,
} from "./stats.ts";

/**
 * 20-dimensional feature vector.
 * Every price-related quantity is divided by the last close
 * so the scale is roughly the same across cheap and expensive stocks.
 */
export function buildFeatures(ohlc: OHLC): number[] {
  const { c, h, l } = ohlc;
  const closes = c;
  const n = closes.length;

  if (n < 50) {
    return new Array(20).fill(0);
  }

  const px = closes[n - 1] > 0 ? closes[n - 1] : 1;
  const safe = (x: number) => (Number.isFinite(x) ? x : 0);

  const rets = logReturns(closes);
  const vol20 = std(rets.slice(-20));
  const vol50 = std(rets.slice(-50));

  const rsi14 = rsi(closes, 14);
  const macdObj = macd(closes);

  const ac1 = autocorrelation(rets, 1);
  const ac5 = autocorrelation(rets, 5);

  const atr14 = atr(h, l, c, 14);
  const bbWidth20 = bollingerWidth(closes, 20);

  const mom5 =
    n > 5 && closes[n - 6] > 0
      ? (closes[n - 1] - closes[n - 6]) / closes[n - 6
