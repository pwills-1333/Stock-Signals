// backend/src/config.ts

export const PORT = Number(Deno.env.get("PORT") || 8000);

export const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY") || "";

export const ARTIFACTS_PATH =
  Deno.env.get("ARTIFACTS_PATH") || "./artifacts/heads_v1.json";

export const DATA_DIR = Deno.env.get("DATA_DIR") || "./data";

export const MIN_RECORDS_FOR_WEIGHTS = 50;

// Cache settings
export const OHLC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Optional: NewsAPI (legacy stub still present; not required for this path)
export const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY") || "";
