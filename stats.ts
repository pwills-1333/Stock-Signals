export function clamp(x: number, lo: number, hi: number) {
return Math.max(lo, Math.min(hi, x));
}

export function sma(xs: number[], n: number) {
if (!xs?.length) return 0;
const w = xs.slice(-n);
return w.reduce((a, b) => a + b, 0) / (w.length || 1);
}

export function logReturns(closes: number[]) {
const r: number[] = [];
for (let i = 1; i < closes.length; i++) {
if (closes[i - 1] > 0 && closes[i] > 0) {
r.push(Math.log(closes[i] / closes[i - 1]));
}

}

return r;
}

export function autocorrelation(xs: number[], lag = 1) {
if (xs.length <= lag + 2) return 0;
const n = xs.length - lag;
let m = 0;
for (const x of xs) m += x;
m /= xs.length;
let num = 0, d0 = 0, d1 = 0;
for (let i = 0; i < n; i++) {
const a = xs[i] - m;
const b = xs[i + lag] - m;
num += a * b;
d0 += a * a;
d1 += b * b;
}

const den = Math.sqrt(d0 * d1);
return den > 0 ? num / den : 0;
}

export function std(xs: number[]) {
if (!xs.length) return 0;
const m = xs.reduce((a, b) => a + b, 0) / xs.length;
return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) /
xs.length);
}

export function percentile(sorted: number[], p: number) {
if (!sorted.length) return 0;
const i = (p / 100) * (sorted.length - 1);
const lo = Math.floor(i), hi = Math.ceil(i);
if (lo === hi) return sorted[lo];
return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}

export function gauss() {
let u = 0, v = 0;
while (u === 0) u = Math.random();
while (v === 0) v = Math.random();
return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function rsi(closes: number[], period = 14) {
if (closes.length < period + 1) return 50;
let au = 0, ad = 0;
for (let i = closes.length - period; i < closes.length; i++) {
const d = closes[i] - closes[i - 1];
if (d >= 0) au += d;
else ad -= d;
}

au /= period;
ad /= period;
if (ad === 0) return 100;
return 100 - 100 / (1 + au / ad);
}

export function macd(closes: number[]) {
const ema = (n: number) => {
const k = 2 / (n + 1);
let e = closes[0];
for (let i = 1; i < closes.length; i++) e = closes[i] * k + e *
(1 - k);
return e;
};

return { hist: (ema(12) - ema(26)) * 0.3 };
}

export function atr(h: number[], l: number[], c: number[], period
= 14) {
if (c.length < 2) return (c[0] || 0) * 0.02;
const trs: number[] = [];
for (let i = 1; i < c.length; i++) {
trs.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]),
Math.abs(l[i] - c[i - 1])));
}

const w = trs.slice(-period);
return w.reduce((a, b) => a + b, 0) / (w.length || 1);
}

export function bollingerWidth(closes: number[], n = 20) {
const w = closes.slice(-n);
if (w.length < 5) return 0;
const m = w.reduce((a, b) => a + b, 0) / w.length;
const s = Math.sqrt(w.reduce((a, x) => a + (x - m) ** 2, 0) /
w.length);
return m ? (2 * s) / m : 0;
}

function dfaHurst(closes: number[]) {
const r = logReturns(closes);
if (r.length < 32) {
return { value: 0.5, method: "dfa", alpha: 0.5, fitError: 1,
confidence: 0 };
}

const profile: number[] = [0];
const mean = r.reduce((a, b) => a + b, 0) / r.length;
for (let i = 0; i < r.length; i++) profile.push(profile[i] + r[i] -
mean);
const sizes = [8, 16, 32, 64].filter((s) => s < profile.length / 2);
if (sizes.length < 2) {
return { value: 0.5, method: "dfa", alpha: 0.5, fitError: 1,
confidence: 0 };
}

const logN: number[] = [], logF: number[] = [];
for (const n of sizes) {
const nSeg = Math.floor((profile.length - 1) / n);
if (nSeg < 1) continue;
let fSum = 0;
for (let s = 0; s < nSeg; s++) {
const start = s * n;
let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
for (let i = 0; i < n; i++) {
const x = i, y = profile[start + i + 1];
sumX += x; sumY += y; sumXX += x * x; sumXY += x * y;
}

const den = n * sumXX - sumX * sumX || 1;
const slope = (n * sumXY - sumX * sumY) / den;
const intercept = (sumY - slope * sumX) / n;
let e = 0;
for (let i = 0; i < n; i++) {
const d = profile[start + i + 1] - (intercept + slope * i);
e += d * d;
}

fSum += e / n;
}

logN.push(Math.log(n));
logF.push(Math.log(Math.sqrt(fSum / nSeg) + 1e-12));
}

if (logN.length < 2) {
return { value: 0.5, method: "dfa", alpha: 0.5, fitError: 1,
confidence: 0 };
}

const n = logN.length;
let sX = 0, sY = 0, sXX = 0, sXY = 0;
for (let i = 0; i < n; i++) {
sX += logN[i]; sY += logF[i]; sXX += logN[i] * logN[i]; sXY +=
logN[i] * logF[i];
}

const alpha = (n * sXY - sX * sY) / (n * sXX - sX * sX || 1);
const H = clamp(alpha, 0.05, 0.95);
const fitError = 0.1;
const confidence = clamp(Math.abs(alpha - 0.5) / (fitError + 0.05), 0,
1);
return { value: H, method: "dfa", alpha, fitError, confidence };
}

export function computeHurst(closes: number[]) {
const r = logReturns(closes);
if (r.length >= 60) return dfaHurst(closes);
return { value: 0.5, method: "r/s", confidence: 0, alpha: 0.5,
fitError: 1 };
}
