import { FINNHUB_API_KEY } from "./config.ts";
import {

rsi, macd, sma, atr, bollingerWidth, logReturns, std, percentile, gauss,
clamp,
} from "./stats.ts";
import type { OHLC } from "./types.ts";

async function finnhubGet(path: string, params: Record<string, string
| number> = {}) {
if (!FINNHUB_API_KEY) return null;
const q = new URLSearchParams({
...Object.fromEntries(
Object.entries(params).map(([k, v]) => [k, String(v)]),
),
token: FINNHUB_API_KEY,
});
const url = `https://finnhub.io/api/v1${path}?${q}`;
try {
const res = await fetch(url);
if (!res.ok) {
console.warn(`Finnhub ${path} → ${res.status}`);
return null;
}

return await res.json();
} catch (e) {
console.warn(`Finnhub ${path} error:`, e);
return null;
}

}

/** Daily OHLC from Finnhub (free tier typically limited to ~1 year).
*/
export async function fetchFinnhubOHLC(ticker: string, days = 180):
Promise<OHLC | null> {
if (!FINNHUB_API_KEY) return null;
const to = Math.floor(Date.now() / 1000);
const from = to - Math.ceil(days * 1.6) * 86400;
const j = await finnhubGet("/stock/candle", {
symbol: ticker.toUpperCase(),
resolution: "D",
from,
to,
});
if (!j || j.s !== "ok" || !Array.isArray(j.c) || j.c.length <
10) {
return null;
}

return {
t: j.t || [],
o: j.o || [],
h: j.h || [],
l: j.l || [],
c: j.c || [],
v: j.v || [],
};

}

export async function fetchQuote(ticker: string) {
const j = await finnhubGet("/quote", { symbol: ticker.toUpperCase()
});
if (!j || typeof j.c !== "number") return null;
return { price: j.c as number, prevClose: j.pc as number, t: j.t as
number };
}

export async function fetchCompanyNews(ticker: string, days = 7) {
if (!FINNHUB_API_KEY) return [];
const to = new Date();
const from = new Date(Date.now() - days * 86400000);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const j = await finnhubGet("/company-news", {
symbol: ticker.toUpperCase(),
from: fmt(from),
to: fmt(to),
});
if (!Array.isArray(j)) return [];
return j.slice(0, 20).map((n: { headline?: string; summary?: string }) => ({
title: n.headline || "",
summary: n.summary || "",
}));
}

const US_SYMBOL_FALLBACK = [
"AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "AMD", "JPM", "TSLA", "AVGO",
"UNH", "XOM", "LLY", "JNJ", "V", "MA", "WMT", "PG", "HD", "ORCL",
"COST", "ABBV", "KO", "MRK", "PEP", "BAC", "CVX", "ADBE", "CRM", "NFLX",
"DIS", "TMO", "CSCO", "ABT", "ACN", "MCD", "DHR", "WFC", "LIN", "TXN",
"PM", "NEE", "INTU", "AMGN", "IBM", "CAT", "GE", "RTX", "QCOM", "ISRG",
"HON", "SPGI", "AMAT", "PFE", "BKNG", "LOW", "SYK", "GS", "UNP", "BLK",
"ADP", "PLD", "MDT", "C", "AXP", "DE", "CB", "ETN", "SCHW", "SBUX",
"GILD", "TJX", "SO", "ZTS", "LMT", "MO", "BMY", "CI", "CME", "TMUS",
"DUK", "EQIX", "ICE", "SHW", "PYPL", "USB", "PNC", "MMM", "GM", "F",
"CVS", "CL", "ITW", "CDNS", "SNPS", "MDLZ", "REGN", "AMT", "SLB", "WM",
"EMR", "NOC", "BDX", "AON", "PH", "WELL", "MSI", "CTAS", "APD", "FDX",
"NSC", "CARR", "GMAB", "PANW", "CRWD", "KLAC", "LRCX", "MU", "INTC", "NOW",
];

function parseSymbolRows(j: unknown) {
if (!Array.isArray(j)) return [];
return j
.map((x: { symbol?: string }) => x.symbol)
.filter((s): s is string => !!s && !s.includes("."));
}

export async function fetchUSSymbols() {
if (FINNHUB_API_KEY) {
const queries = [
{ exchange: "US" },
{ exchange: "US", mic: "XNGS" },
{ exchange: "US", mic: "XNYS" },
];
const found = new Set<string>();
for (const params of queries) {
const rows = parseSymbolRows(await finnhubGet("/stock/symbol", params));
for (const s of rows) found.add(s);
}

if (found.size) return [...found];
}

return [...US_SYMBOL_FALLBACK];
}

export async function searchSymbols(query: string) {
const q = query.trim();
if (!q) return [];
if (FINNHUB_API_KEY) {
const j = await finnhubGet("/search", { q });
if (j && Array.isArray(j.result) && j.result.length) {
const hits = j.result.slice(0, 20).map((
r: { symbol?: string; displaySymbol?: string; description?: string; type?: string },
) => ({
symbol: String(r.symbol || r.displaySymbol || "").toUpperCase(),
description: r.description || "",
type: r.type || "",
})).filter((r) => !!r.symbol);
if (hits.length) return hits;
}

}

const symbol = q.toUpperCase().replace(/[^A-Z.]/g, "");
if (symbol) {
return [{ symbol, description: "Direct ticker", type: "manual" }];
}

return [];
}

export function computeTechnicals(ohlc: { c: number[]; h: number[];
l: number[]; v: number[] }) {
const closes = ohlc.c;
return {
rsi: rsi(closes),
macd: macd(closes),
sma20: sma(closes, 20),
sma50: sma(closes, 50),
sma200: sma(closes, Math.min(200, closes.length)),
atr: atr(ohlc.h, ohlc.l, closes),
bollWidth: bollingerWidth(closes),
lastClose: closes[closes.length - 1],
lastVolume: ohlc.v[ohlc.v.length - 1] || 0,
avgVolume: ohlc.v.slice(-30).reduce((a, b) => a + b, 0) / Math.min(30,
ohlc.v.length || 1),
};

}

export function computeGARCH(closes: number[]) {
const r = logReturns(closes);
if (r.length < 30) {
const s = std(r) || 0.01;
return { sigma: s, regime: "normal", volRatio: 1, longVar: s * s };
}

const longVar = r.reduce((a, x) => a + x * x, 0) / r.length;
const alpha = 0.08, beta = 0.88;
const omega = (1 - alpha - beta) * longVar;
let sig2 = longVar;
for (let i = 1; i < r.length; i++) {
sig2 = omega + alpha * r[i - 1] ** 2 + beta * sig2;
}

const sigma = Math.sqrt(Math.max(sig2, 1e-12));
const ratio = sigma / Math.sqrt(longVar);
let regime = "normal";
if (ratio > 1.3) regime = "high";
else if (ratio < 0.8) regime = "low";
return { sigma, regime, volRatio: ratio, longVar: Math.max(longVar,
1e-6) };
}

export function hestonMonteCarlo(
S0: number,
mu: number,
v0: number,
kappa: number,
theta: number,
xi: number,
rho: number,
days: number,
paths = 1500,
) {
const dt = 1 / 252;
const finals: number[] = [];
for (let p = 0; p < paths; p++) {
let S = S0, v = v0;
for (let i = 0; i < days; i++) {
const z1 = gauss();
const z2 = rho * z1 + Math.sqrt(Math.max(0, 1 - rho * rho)) *
gauss();
v = Math.max(
0,
v + kappa * (theta - v) * dt + xi * Math.sqrt(Math.max(v, 0)) *
Math.sqrt(dt) * z2,
);

S = S * Math.exp((mu - 0.5 * v) * dt + Math.sqrt(Math.max(v, 0)) *
Math.sqrt(dt) * z1);
}

finals.push(S);
}

finals.sort((a, b) => a - b);
const meanF = finals.reduce((a, b) => a + b, 0) / paths;
const p5 = percentile(finals, 5);
const p95 = percentile(finals, 95);
return {
mean: meanF,
p5,
p95,
confidence: clamp(1 - (p95 - p5) / (S0 * 2 + 1e-9), 0, 1),
};

}
