import { OHLC } from "../types.ts";

const BASE = "https://query1.finance.yahoo.com";

async function fetchJSON(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchYahooOHLC(ticker: string): Promise<OHLC | null> {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 365 * 24 * 3600;

  const url =
    `${BASE}/v8/finance/chart/${ticker}` +
    `?period1=${start}&period2=${now}&interval=1d`;

  const data = await fetchJSON(url);
  if (!data || !data.chart || !data.chart.result) return null;

  const result = data.chart.result[0];
  if (!result || !result.indicators || !result.indicators.quote) return null;

  const quote = result.indicators.quote[0];
  const timestamps = result.timestamp;

  if (!Array.isArray(timestamps) || timestamps.length === 0) return null;

  const o = quote.open ?? [];
  const h = quote.high ?? [];
  const l = quote.low ?? [];
  const c = quote.close ?? [];
  const v = quote.volume ?? [];

  const clean = (arr: number[]) =>
    arr.map((x) => (Number.isFinite(x) ? x : 0));

  return {
    t: clean(timestamps),
    o: clean(o),
    h: clean(h),
    l: clean(l),
    c: clean(c),
    v: clean(v)
  };
}

export async function fetchYahooQuote(ticker: string): Promise<number> {
  const url = `${BASE}/v7/finance/quote?symbols=${ticker}`;
  const data = await fetchJSON(url);

  try {
    const price = data.quoteResponse.result[0].regularMarketPrice;
    return Number.isFinite(price) ? price : 0;
  } catch {
    return 0;
  }
}

export async function fetchYahooNews(ticker: string): Promise<any[]> {
  const url = `${BASE}/v1/finance/search?q=${ticker}`;
  const data = await fetchJSON(url);

  if (!data || !Array.isArray(data.news)) return [];
  return data.news;
}
