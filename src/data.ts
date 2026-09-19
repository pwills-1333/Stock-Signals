// src/data.ts
import type { OHLC } from "./types.ts";
import { fetchYahooOHLC } from "./data/yahoo.ts";
import { fetchFinnhubOHLC } from "./data/finnhub.ts";

export async function fetchOHLC(ticker: string): Promise<OHLC | null> {
  // Try Yahoo first
  const yahoo = await fetchYahooOHLC(ticker);
  if (yahoo && yahoo.c.length > 0) {
    return yahoo;
  }

  // Fallback to Finnhub
  const finnhub = await fetchFinnhubOHLC(ticker);
  if (finnhub && finnhub.c.length > 0) {
    return finnhub;
  }

  return null;
}
