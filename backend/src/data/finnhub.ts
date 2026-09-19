import { OHLC } from "../types.ts";
import { FINNHUB_API_KEY } from "../config.ts";

const BASE = "https://finnhub.io/api/v1";

async function fetchJSON(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchFinnhubOHLC(ticker: string): Promise<OHLC | null> {
  if (!FINNHUB_API_KEY) return null;

  const now = Math.floor(Date.now() / 1000);
  const start = now - 365 * 24 * 3600;

  const url =
    `${BASE}/stock/candle?symbol=${ticker}` +
    `&resolution=D&from=${start}&to=${now}&token=${FINNHUB_API_KEY}`;

  const data = await fetchJSON(url);
  if (!data || data.s !== "ok") return null;

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
  if (!FINNHUB_API_KEY) return 0;

  const url = `${BASE}/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`;
  const data = await fetchJSON(url);

  const price = data?.c;
  return Number.isFinite(price) ? price : 0;
}

export async function fetchFinnhubNews(ticker: string): Promise<any[]> {
  if (!FINNHUB_API_KEY) return [];

  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 24 * 3600;

  const url =
    `${BASE}/company-news?symbol=${ticker}` +
    `&from=${new Date(weekAgo * 1000).toISOString().slice(0, 10)}` +
    `&to=${new Date(now * 1000).toISOString().slice(0, 10)}` +
    `&token=${FINNHUB_API_KEY}`;

  const data = await fetchJSON(url);
  if (!Array.isArray(data)) return [];

  return data.map((n: any) => ({
    headline: n.headline ?? "",
    summary: n.summary ?? "",
    url: n.url ?? "",
    datetime: n.datetime ? new Date(n.datetime * 1000).toISOString() : "",
    source: n.source ?? ""
  }));
}
