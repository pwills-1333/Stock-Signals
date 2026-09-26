import { OHLC } from "../types.ts";
import { FINNHUB_API_KEY } from "../config.ts";

const BASE = "https://finnhub.io/api/v1";

/**
 * Finnhub requires a User-Agent header.
 * Without it, Finnhub silently rejects the request.
 */
async function fetchJSON(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Stock-Signals/1.0 (pwills-1333)",
        "Accept": "application/json"
      }
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

export async function fetchFinnhubOHLC(ticker: string): Promise<OHLC | null> {
  if (!FINNHUB_API_KEY) {
    console.warn("Finnhub API key missing");
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const start = now - 365 * 24 * 3600;

  const url =
    `${BASE}/stock/candle?symbol=${ticker}` +
    `&resolution=D&from=${start}&to=${now}&token=${FINNHUB_API_KEY}`;

  const data = await fetchJSON(url);

  if (!data || data.s !== "ok") {
    console.warn("Finnhub OHLC returned invalid response:", data);
    return null;
  }

  const clean = (arr: number[]) =>
    arr.map((x) => (Number.isFinite(x) ? x : 0));

  return {
    t: clean(data.t ?? []),
    o: clean(data.o ?? []),
    h: clean(data.h ?? []),
    l: clean(data.l ?? []),
    c: clean(data.c ?? []),
    v: clean(data.v ?? [])
  };
}

export async function fetchFinnhubQuote(ticker: string): Promise<number> {
  if (!FINNHUB_API_KEY) {
    console.warn("Finnhub API key missing");
    return 0;
  }

  const url = `${BASE}/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`;
  const data = await fetchJSON(url);

  const price = data?.c;
  return Number.isFinite(price) ? price : 0;
}

export async function fetchFinnhubNews(ticker: string): Promise<any[]> {
  if (!FINNHUB_API_KEY) {
    console.warn("Finnhub API key missing");
    return [];
  }

  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 24 * 3600;

  const url =
    `${BASE}/company-news?symbol=${ticker}` +
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
    source: n.source ?? ""
  }));
}

  const t: number[] = [];
  const o: number[] = [];
  // ... same loop pattern as Yahoo: only push if c[i] > 0
