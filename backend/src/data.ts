// backend/src/data.ts
import type { OHLC } from "./types.ts";
import { fetchFinnhubOHLC } from "./data/finnhub.ts";
import { fetchYahooOHLC } from "./data/yahoo.ts";
import { getCachedOHLC, setCachedOHLC } from "./cache.ts";

/** Prefer enough history for SMA200 + buffer */
const MIN_BARS = 50;
const PREFERRED_BARS = 200;

/**
 * Primary: Finnhub
 * Fallback: Yahoo Finance
 * With short-term in-memory cache
 */
export async function fetchOHLC(ticker: string): Promise<OHLC | null> {
  const symbol = ticker.toUpperCase().trim();
  if (!symbol) return null;

  const cached = getCachedOHLC(symbol);
  if (cached && cached.c.length >= MIN_BARS) {
    return cached;
  }

  let best: OHLC | null = null;

  try {
    const finnhub = await fetchFinnhubOHLC(symbol);
    if (finnhub && finnhub.c.length >= MIN_BARS) {
      best = finnhub;
      if (finnhub.c.length >= PREFERRED_BARS) {
        setCachedOHLC(symbol, finnhub);
        return finnhub;
      }
    }
  } catch (err) {
    console.warn("Finnhub failed:", err);
  }

  try {
    const yahoo = await fetchYahooOHLC(symbol);
    if (yahoo && yahoo.c.length >= MIN_BARS) {
      // Prefer the longer series when both exist
      if (!best || yahoo.c.length > best.c.length) {
        best = yahoo;
      }
    }
  } catch (err) {
    console.warn("Yahoo failed:", err);
  }

  if (best) {
    setCachedOHLC(symbol, best);
    return best;
  }

  return null;
}
