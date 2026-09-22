// backend/src/data/yahoo.ts
import type { OHLC } from "../types.ts";

const BASE = "https://query1.finance.yahoo.com";

async function fetchJSON(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.warn(`Yahoo HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn("Yahoo fetch error:", err);
    return null;
  }
}

export async function fetchYahooOHLC(ticker: string): Promise<OHLC | null> {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 400 * 24 * 3600; // ~13 months

  const url =
    `${BASE}/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?period1=${start}&period2=${now}&interval=1d&events=history`;

  const data = await fetchJSON(url);
  if (!data?.chart?.result?.[0]) return null;

  const result = data.chart.result[0];
  const quote = result.indicators?.quote?.[0];
  const timestamps = result.timestamp;

  if (!Array.isArray(timestamps) || timestamps.length === 0 || !quote) {
    return null;
  }

  const clean = (arr: any[]): number[] =>
    (arr || []).map((x) => (Number.isFinite(x) ? Number(x) : 0));

  return {
    t: clean(timestamps),
    o: clean(quote.open),
    h: clean(quote.high),
    l: clean(quote.low),
    c: clean(quote.close),
    v: clean(quote.volume),
  };
}

export async function fetchYahooQuote(ticker: string): Promise<number> {
  const url = `${BASE}/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;
  const data = await fetchJSON(url);

  try {
    const price = data?.quoteResponse?.result?.[0]?.regularMarketPrice;
    return Number.isFinite(price) ? price : 0;
  } catch {
    return 0;
  }
}
