import { OHLC } from "./types.ts";
import {
  sma,
  logReturns,
  autocorrelation,
  std,
  rsi,
  macd,
  atr,
  bollingerWidth,
  clamp
} from "./stats.ts";

export function buildFeatures(ohlc: OHLC): number[] {
  const { c, h, l } = ohlc;

  const closes = c;
  const n = closes.length;

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

  const volRatio =
    vol50 > 0 ? clamp(vol20 / vol50, 0, 5) : 1;

  const features = [
    safe(rsi14 / 100),
    safe(macdObj.hist),
    safe(sma(closes, 20) - sma(closes, 50)),
    safe(sma(closes, 50) - sma(closes, 200)),
    safe(mom5),
    safe(mom10),
    safe(mom20),
    safe(vol20),
    safe(volRatio),
    safe(ac1),
    safe(ac5),
    safe(atr14),
    safe(bbWidth20),
    safe(std(rets)),
    safe(rets.slice(-1)[0] ?? 0),
    safe(rets.slice(-5).reduce((a, b) => a + b, 0)),
    safe(rets.slice(-10).reduce((a, b) => a + b, 0)),
    safe(closes[n - 1] - closes[Math.max(0, n - 2)]),
    safe(closes[n - 1] - closes[Math.max(0, n - 6)]),
    safe(closes[n - 1] - closes[Math.max(0, n - 11)])
  ];

  return features.map((x) => (Number.isFinite(x) ? x : 0));
}
