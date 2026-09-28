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
 * ALL price-level quantities are divided by last close
 * so features stay in return-like units across cheap & expensive stocks.
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
    safe(rsi14 / 100),                                    // 0
    safe(macdObj.hist / px),                              // 1
    safe((sma(closes, 20) - sma(closes, 50)) / px),       // 2
    safe((sma(closes, 50) - sma(closes, 200)) / px),      // 3
    safe(mom5),                                           // 4
    safe(mom10),                                          // 5
    safe(mom20),                                          // 6
    safe(vol20),                                          // 7
    safe(volRatio),                                       // 8
    safe(ac1),                                            // 9
    safe(ac5),                                            // 10
    safe(atr14 / px),                                     // 11
    safe(bbWidth20 / px),                                 // 12
    safe(std(rets)),                                      // 13
    safe(rets.slice(-1)[0] ?? 0),                         // 14
    safe(rets.slice(-5).reduce((a, b) => a + b, 0)),      // 15
    safe(rets.slice(-10).reduce((a, b) => a + b, 0)),     // 16
    safe((closes[n - 1] - closes[Math.max(0, n - 2)]) / px),  // 17
    safe((closes[n - 1] - closes[Math.max(0, n - 6)]) / px),  // 18
    safe((closes[n - 1] - closes[Math.max(0, n - 11)]) / px), // 19
  ];

  return features.map((x) => (Number.isFinite(x) ? x : 0));
}
