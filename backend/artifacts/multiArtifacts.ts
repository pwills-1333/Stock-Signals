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
      ? (closes[n - 1] - closes[n - 6]) / closes[n - 6]
      : 0;
  const mom10 =
    n > 10 && closes[n - 11] > 0
      ? (closes[n - 1] - closes[n - 11]) / closes[n - 11]
      : 0;
  const mom20 =
    n > 20 && closes[n - 21] > 0
      ? (closes[n - 1] - closes[n - 21]) / closes[n - 21]
      : 0;

  const volRatio = vol50 > 0 ? clamp(vol20 / vol50, 0, 5) : 1;

  const features = [
    safe(rsi14 / 100),                                    // 0  RSI
    safe(macdObj.hist / px),                              // 1  MACD hist (price-norm)
    safe((sma(closes, 20) - sma(closes, 50)) / px),       // 2  SMA20-50
    safe((sma(closes, 50) - sma(closes, 200)) / px),      // 3  SMA50-200
    safe(mom5),                                           // 4  5-day momentum
    safe(mom10),                                          // 5  10-day momentum
    safe(mom20),                                          // 6  20-day momentum
    safe(vol20),                                          // 7  20-day vol
    safe(volRatio),                                       // 8  vol ratio
    safe(ac1),                                            // 9  AC lag 1
    safe(ac5),                                            // 10 AC lag 5
    safe(atr14 / px),                                     // 11 ATR %
    safe(bbWidth20 / px),                                 // 12 BB width %
    safe(std(rets)),                                      // 13 overall vol
    safe(rets.slice(-1)[0] ?? 0),                         // 14 last return
    safe(rets.slice(-5).reduce((a, b) => a + b, 0)),      // 15 5-day cum ret
    safe(rets.slice(-10).reduce((a, b) => a + b, 0)),     // 16 10-day cum ret
    safe((closes[n - 1] - closes[Math.max(0, n - 2)]) / px),  // 17 1-day Δ
    safe((closes[n - 1] - closes[Math.max(0, n - 6)]) / px),  // 18 5-day Δ
    safe((closes[n - 1] - closes[Math.max(0, n - 11)]) / px), // 19 10-day Δ
  ];

  return features.map((x) => (Number.isFinite(x) ? x : 0));
}
