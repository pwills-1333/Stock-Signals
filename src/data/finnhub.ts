import { FINNHUB_API_KEY } from "../config.ts";
import type { OHLC } from "../types.ts";

async function finnhubGet(path: string, params: Record<string, string | number> = {}) {
  if (!FINNHUB_API_KEY) return null;
  const q = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
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

export async function fetchFinnhubOHLC(ticker: string, days = 180): Promise<OHLC | null> {
  if (!FINNHUB_API_KEY) return null;
  const to = Math.floor(Date.now() / 1000);
  const from = to - Math.ceil(days * 1.6) * 86400;
  const j = await finnhubGet("/stock/candle", {
    symbol: ticker.toUpperCase(),
    resolution: "D",
    from,
    to,
  });
  if (!j || j.s !== "ok" || !Array.isArray(j.c) || j.c.length < 10) return null;
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
  const j = await finnhubGet("/quote", { symbol: ticker.toUpperCase() });
  if (!j || typeof j.c !== "number") return null;
  return { price: j.c as number, prevClose: j.pc as number, t: j.t as number };
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

export async function fetchUSSymbols() {
  if (!FINNHUB_API_KEY) {
    return ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "AMD", "JPM", "TSLA", "AVGO"];
  }
  const j = await finnhubGet("/stock/symbol", { exchange: "US" });
  if (!Array.isArray(j)) return [];
  return (j || [])
    .map((x: { symbol?: string }) => x.symbol)
    .filter((s: string) => s && !s.includes("."));
}
