// backend/src/data/yahoo.ts
import type { OHLC } from "../types.ts";

/**
 * Correct Yahoo Finance base URL.
 * query2 is required — query1 fails for many tickers.
 */
const BASE = "https://query2.finance.yahoo.com/v8/finance/chart";

/**
 * Yahoo requires a User-Agent header.
 * Without it, Yahoo returns 404 or empty chart data.
 */
async function fetchJSON(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
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
  const range = "1y";      // 1 year of data
  const interval = "1d";   // daily candles

  const url =
    `${BASE}/${encodeURIComponent(ticker)}` +
    `?range=${range}&interval=${interval}&includePrePost=false&events=history`;

  const data = await fetchJSON(url);

  // Validate structure
  if (!data?.chart?.result?.[0]) {
    console.warn("Yahoo returned invalid chart:", data);
    return null;
  }

  const result = data.chart.result[0];
  const quote = result.indicators?.quote?.[0];
  const timestamps = result.timestamp;

  if (!Array.isArray(timestamps) || timestamps.length === 0 || !quote) {
    console.warn("Yahoo returned empty OHLC arrays");
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
    v: clean(quote.volume)
  };
}

export async function fetchYahooQuote(ticker: string): Promise<number> {
  const url =
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;

  const data = await fetchJSON(url);

  try {
    const price = data?.quoteResponse?.result?.[0]?.regularMarketPrice;
    return Number.isFinite(price) ? price : 0;
  } catch {
    return 0;
  }
}
