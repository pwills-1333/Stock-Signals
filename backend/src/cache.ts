// backend/src/cache.ts
import { OHLC_CACHE_TTL_MS } from "./config.ts";
import type { OHLC } from "./types.ts";

interface CacheEntry {
  data: OHLC;
  expires: number;
}

const ohlcCache = new Map<string, CacheEntry>();

export function getCachedOHLC(ticker: string): OHLC | null {
  const key = ticker.toUpperCase();
  const entry = ohlcCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expires) {
    ohlcCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedOHLC(ticker: string, data: OHLC): void {
  const key = ticker.toUpperCase();
  ohlcCache.set(key, {
    data,
    expires: Date.now() + OHLC_CACHE_TTL_MS,
  });
}

export function clearOHLCCache(): void {
  ohlcCache.clear();
}
