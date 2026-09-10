import { clamp } from "./stats.ts";

export const FEATURE_NAMES = [
"rsi", "macdHist", "smaSpread20_50", "smaSpread50_200",
"mom5", "mom10", "mom20", "vol20", "volRatio",
"sentiment", "volumeRatio", "hurst", "ret1", "ret5",
] as const;
export function buildFeatureVector(ctx: {
closes: number[];
rsi: number;
macdHist: number;
sma20: number;
sma50: number;
sma200: number;
garchSigma: number;
longVol: number;
sentiment: number;
volumeRatio: number;
hurst: number;
}): number[] {
const c = ctx.closes;
const n = c.length;
const last = c[n - 1];
const ret = (a: number, b: number) => (b > 0 ? (a - b) / b : 0);
const rets: number[] = [];
for (let i = 1; i < n; i++) if (c[i - 1] > 0)
rets.push(Math.log(c[i] / c[i - 1]));
const s = rets.slice(-20);
let vol20 = ctx.garchSigma;
if (s.length >= 5) {
const m = s.reduce((a, b) => a + b, 0) / s.length;
vol20 = Math.sqrt(s.reduce((a, x) => a + (x - m) ** 2, 0) /
s.length);
}

return [
ctx.rsi / 100,
clamp(ctx.macdHist / (last || 1), -0.05, 0.05),
(ctx.sma20 - ctx.sma50) / (ctx.sma50 || 1),
(ctx.sma50 - ctx.sma200) / (ctx.sma200 || 1),
ret(last, c[Math.max(0, n - 6)]),
ret(last, c[Math.max(0, n - 11)]),
ret(last, c[Math.max(0, n - 21)]),
vol20,
ctx.longVol > 0 ? ctx.garchSigma / Math.sqrt(ctx.longVol) : 1,
clamp(ctx.sentiment, -1, 1),
clamp(ctx.volumeRatio, 0, 5) / 5,
clamp(ctx.hurst, 0, 1),
ret(last, c[Math.max(0, n - 2)]),
ret(last, c[Math.max(0, n - 6)]),
];
}
