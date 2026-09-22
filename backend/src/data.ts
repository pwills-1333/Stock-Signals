// backend/src/data.ts
import type { OHLC } from "./types.ts";
import { fetchFinnhubOHLC } from "./data/finnhub.ts";
import { fetchYahooOHLC } from "./data/yahoo.ts";

/**
 * Primary: Finnhub
 * Fallback: Yahoo Finance
 */
export async function fetchOHLC(ticker: string): Promise<OHLC | null> {
  const symbol = ticker.toUpperCase().trim();

  // 1. Try Finnhub first
  try {
    const finnhub = await fetchFinnhubOHLC(symbol);
    if (finnhub && finnhub.c.length >= 30) {
      return finnhub;
    }
  } catch (err) {
    console.warn("Finnhub failed:", err);
  }

  // 2. Fallback to Yahoo
  try {
    const yahoo = await fetchYahooOHLC(symbol);
    if (yahoo && yahoo.c.length >= 30) {
      return yahoo;
    }
  } catch (err) {
    console.warn("Yahoo failed:", err);
  }

  return null;
}
