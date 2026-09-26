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

function isValidPrice(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 0;
}

export async function fetchYahooOHLC(ticker: string): Promise<OHLC | null> {
  const range = "1y";
  const interval = "1d";

  const url =
    `${BASE}/${encodeURIComponent(ticker)}` +
    `?range=${range}&interval=${interval}&includePrePost=false&events=history`;

  const data = await fetchJSON(url);

  if (!data?.chart?.result?.[0]) {
    console.warn("Yahoo returned invalid chart:", data);
    return null;
  }

  const result = data.chart.result[0];
  const quote = result.indicators?.quote?.[0];
  const timestamps: number[] = result.timestamp ?? [];

  if (!Array.isArray(timestamps) || timestamps.length === 0 || !quote) {
    console.warn("Yahoo returned empty OHLC arrays");
    return null;
  }

  const opens = quote.open ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const closes = quote.close ?? [];
  const volumes = quote.volume ?? [];

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
      Number.isFinite(volumes[i]) && volumes[i] >= 0 ? Number(volumes[i]) : 0;

    t.push(timestamps[i]);
    o.push(oi);
    h.push(Math.max(hi, lo, oi, close));
    l.push(Math.min(lo, hi, oi, close));
    c.push(close);
    v.push(vol);
  }

  if (c.length < 30) {
    console.warn(`Yahoo: only ${c.length} valid bars for ${ticker}`);
    return null;
  }

  return { t, o, h, l, c, v };
}

export async function fetchYahooQuote(ticker: string): Promise<number> {
  const url =
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;

  const data = await fetchJSON(url);

  try {
    const price = data?.quoteResponse?.result?.[0]?.regularMarketPrice;
    return Number.isFinite(price) && price > 0 ? price : 0;
  } catch {
    return 0;
  }
}
