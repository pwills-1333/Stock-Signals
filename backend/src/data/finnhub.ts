// backend/src/data/finnhub.ts
import type { OHLC } from "../types.ts";
import { FINNHUB_API_KEY } from "../config.ts";

const BASE = "https://finnhub.io/api/v1";

/**
 * Finnhub often works better with a User-Agent.
 */
async function fetchJSON(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Stock-Signals/1.0 (pwills-1333)",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.warn("Finnhub HTTP error:", res.status, await res.text());
      return null;
    }

    return await res.json();
  } catch (err) {
    console.warn("Finnhub fetch failed:", err);
    return null;
  }
}

function isValidPrice(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 0;
}

export async function fetchFinnhubOHLC(ticker: string): Promise<OHLC | null> {
  if (!FINNHUB_API_KEY) {
    console.warn("Finnhub API key missing");
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const start = now - 365 * 24 * 3600;

  const url =
    `${BASE}/stock/candle?symbol=${encodeURIComponent(ticker)}` +
    `&resolution=D&from=${start}&to=${now}&token=${FINNHUB_API_KEY}`;

  const data = await fetchJSON(url);

  // Finnhub: s === "ok" with arrays; otherwise "no_data" / error
  if (!data || data.s !== "ok") {
    console.warn("Finnhub OHLC returned invalid response:", data);
    return null;
  }

  const timestamps: number[] = data.t ?? [];
  const opens: number[] = data.o ?? [];
  const highs: number[] = data.h ?? [];
  const lows: number[] = data.l ?? [];
  const closes: number[] = data.c ?? [];
  const volumes: number[] = data.v ?? [];

  if (!Array.isArray(timestamps) || timestamps.length === 0) {
    return null;
  }

  const t: number[] = [];
  const o: number[] = [];
  const h: number[] = [];
  const l: number[] = [];
  const c: number[] = [];
  const v: number[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (!isValidPrice(close)) continue;

    const oi = isValidPrice(opens[i]) ? opens[i] : close;
    const hi = isValidPrice(highs[i]) ? highs[i] : close;
    const lo = isValidPrice(lows[i]) ? lows[i] : close;
    const vol =
      Number.isFinite(volumes[i]) && volumes[i] >= 0 ? volumes[i] : 0;

    t.push(timestamps[i]);
    o.push(oi);
    h.push(Math.max(hi, lo, oi, close));
    l.push(Math.min(lo, hi, oi, close));
    c.push(close);
    v.push(vol);
  }

  if (c.length < 30) {
    console.warn(`Finnhub: only ${c.length} valid bars for ${ticker}`);
    return null;
  }

  return { t, o, h, l, c, v };
}

export async function fetchFinnhubQuote(ticker: string): Promise<number> {
  if (!FINNHUB_API_KEY) {
    console.warn("Finnhub API key missing");
    return 0;
  }

  const url =
    `${BASE}/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_API_KEY}`;
  const data = await fetchJSON(url);

  const price = data?.c;
  return Number.isFinite(price) && price > 0 ? price : 0;
}

export async function fetchFinnhubNews(ticker: string): Promise<any[]> {
  if (!FINNHUB_API_KEY) {
    console.warn("Finnhub API key missing");
    return [];
  }

  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 24 * 3600;

  const url =
    `${BASE}/company-news?symbol=${encodeURIComponent(ticker)}` +
    `&from=${new Date(weekAgo * 1000).toISOString().slice(0, 10)}` +
    `&to=${new Date(now * 1000).toISOString().slice(0, 10)}` +
    `&token=${FINNHUB_API_KEY}`;

  const data = await fetchJSON(url);

  if (!Array.isArray(data)) {
    console.warn("Finnhub news returned invalid response:", data);
    return [];
  }

  return data.map((n: any) => ({
    headline: n.headline ?? "",
    summary: n.summary ?? "",
    url: n.url ?? "",
    datetime: n.datetime ? new Date(n.datetime * 1000).toISOString() : "",
    source: n.source ?? "",
  }));
}
