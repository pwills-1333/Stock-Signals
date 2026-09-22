// backend/src/data.ts
import type { OHLC } from "./types.ts";
import { fetchFinnhubOHLC } from "./data/finnhub.ts";
import { fetchYahooOHLC } from "./data/yahoo.ts";
import { getCachedOHLC, setCachedOHLC } from "./cache.ts";

/**
 * Primary: Finnhub
 * Fallback: Yahoo Finance
 * With short-term in-memory cache
 */
export async function fetchOHLC(ticker: string): Promise<OHLC | null> {
  const symbol = ticker.toUpperCase().trim();

  // Check cache first
  const cached = getCachedOHLC(symbol);
  if (cached) {
    return cached;
  }

  // 1. Try Finnhub
  try {
    const finnhub = await fetchFinnhubOHLC(symbol);
    if (finnhub && finnhub.c.length >= 30) {
      setCachedOHLC(symbol, finnhub);
      return finnhub;
    }
  } catch (err) {
    console.warn("Finnhub failed:", err);
  }

  // 2. Fallback to Yahoo
  try {
    const yahoo = await fetchYahooOHLC(symbol);
    if (yahoo && yahoo.c.length >= 30) {
      setCachedOHLC(symbol, yahoo);
      return yahoo;
    }
  } catch (err) {
    console.warn("Yahoo failed:", err);
  }

  return null;
}
