import { rsi, macd, sma, bollingerWidth, computeHurst, logReturns, std } from "./stats.ts";
import type { OHLC } from "./types.ts";

export function extractFeatures(ohlc: OHLC, sentimentS = 0) {
  const c = ohlc.c;
  const v = ohlc.v;
  if (c.length < 30) return null;

  const last = c[c.length - 1];
  const r = logReturns(c);
  const vol20 = std(r.slice(-20)) || 0.02;
  const avgVol = v.slice(-30).reduce((a, b) => a + b, 0) / 30 || 1;

  return {
    rsi: rsi(c) / 100,
    macdHist: macd(c).hist / (last || 1),
    smaSpread20_50: (sma(c, 20) - sma(c, 50)) / last,
    smaSpread50_200: (sma(c, 50) - sma(c, Math.min(200, c.length))) / last,
    mom5: (last - c[c.length - 6]) / c[c.length - 6],
    mom10: (last - c[c.length - 11]) / c[c.length - 11],
    mom20: (last - c[c.length - 21]) / c[c.length - 21],
    vol20,
    volRatio: 1,
    sentiment: sentimentS,
    volumeRatio: Math.min(5, (v[v.length - 1] || 0) / avgVol) / 5,
    hurst: computeHurst(c).value,
    ret1: (last - c[c.length - 2]) / c[c.length - 2],
    ret5: (last - c[c.length - 6]) / c[c.length - 6],
  };
}
