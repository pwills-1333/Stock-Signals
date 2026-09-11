import { clamp } from "./stats.ts";
import type { OHLC } from "./types.ts";

const POS = [
"beat", "beats", "surge", "rally", "upgrade", "buy",
"strong", "record",
"profit", "gain", "growth", "expand", "outperform",
"bullish", "raise",
];
const NEG = [
"miss", "misses", "plunge", "drop", "crash", "downgrade",
"sell", "loss",
"lawsuit", "probe", "fraud", "warn", "cut", "weak",
"recall", "bearish",
"slump", "default", "bankrupt",
];
const YAHOO_HEADERS = {
"User-Agent":
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
Accept: "application/json,text/plain,*/*",
};

async function fetchWithRetry(url: string, attempts = 2):
Promise<Response> {
let lastErr: unknown;
for (let i = 0; i < attempts; i++) {
try {
const res = await fetch(url, { headers: YAHOO_HEADERS });
if (res.ok || res.status === 404) return res;
lastErr = new Error(`status ${res.status}`);
} catch (e) {
lastErr = e;
}

await new Promise((r) => setTimeout(r, 400 * (i + 1)));
}

throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchYahooOHLC(ticker: string, days = 180):
Promise<OHLC> {
const rangeDays = Math.ceil(days * 1.5);
const url =
`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${rangeDays}d&interval=1d`;
const res = await fetchWithRetry(url);
if (!res.ok) throw new Error(`Yahoo OHLC ${ticker}: ${res.status}`);
const j = await res.json();
const r = j?.chart?.result?.[0];
if (!r) throw new Error(`Yahoo empty ${ticker}`);
const q = r.indicators.quote[0];
const adj = r.indicators.adjclose?.[0]?.adjclose;
return {
t: r.timestamp || [],
o: q.open || [],
h: q.high || [],
l: q.low || [],
c: adj || q.close || [],
v: q.volume || [],
};

}

export async function fetchYahooNews(ticker: string, limit = 20) {
try {
const url =
`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=${limit}`;
const res = await fetchWithRetry(url);
if (!res.ok) return [];
const j = await res.json();
return (j.news || []).map((n: { title?: string; summary?: string }) => ({
title: n.title || "",
summary: n.summary || "",
}));
} catch {
return [];
}

}

export function scoreSentiment(news: { title?: string; summary?: string
}[]) {
let polarity = 0, intensity = 0;
const items: { title?: string; score: number }[] = [];
for (const n of news || []) {
const text = ((n.title || "") + " " + (n.summary ||
"")).toLowerCase();
let p = 0;
for (const w of POS) if (text.includes(w)) p += 1;
for (const w of NEG) if (text.includes(w)) p -= 1;
p = clamp(p, -2, 2);
polarity += p;
intensity += Math.abs(p);
items.push({ title: n.title, score: p });
}

const len = news?.length || 0;
const norm = len ? polarity / (len * 3) : 0;
return {
S: clamp(norm, -1, 1),
E: clamp(intensity / (len * 3 || 1), 0, 1),
items,
count: len,
velocity: len,
};

}

export function detectShock(sentiment: { S: number; E: number },
volumeRatio: number) {
const score = sentiment.E * Math.abs(sentiment.S) * Math.max(1,
volumeRatio);
return { shock: score > 0.35, score };
}
