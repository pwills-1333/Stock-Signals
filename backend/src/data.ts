// backend/src/data.ts
import type { OHLC } from "./types.ts";
import { fetchFinnhubOHLC } from "./data/finnhub.ts";
import { fetchYahooOHLC } from "./data/yahoo.ts";
import { getCachedOHLC, setCachedOHLC } from "./cache.ts";

const MIN_BARS = 50;

/**
 * Primary: Finnhub
 * Fallback: Yahoo Finance
 * With short-term in-memory cache
 */
export async function fetchOHLC(ticker: string): Promise<OHLC | null> {
  const symbol = ticker.toUpperCase().trim();

  const cached = getCachedOHLC(symbol);
  if (cached && cached.c.length >= MIN_BARS) {
    return cached;
  }

  try {
    const finnhub = await fetchFinnhubOHLC(symbol);
    if (finnhub && finnhub.c.length >= MIN_BARS) {
      setCachedOHLC(symbol, finnhub);
      return finnhub;
    }
  } catch (err) {
    console.warn("Finnhub failed:", err);
  }

  try {
    const yahoo = await fetchYahooOHLC(symbol);
    if (yahoo && yahoo.c.length >= MIN_BARS) {
      setCachedOHLC(symbol, yahoo);
      return yahoo;
    }
  } catch (err) {
    console.warn("Yahoo failed:", err);
  }

  return null;
}
