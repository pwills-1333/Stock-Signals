// backend/src/config.ts

export const PORT = Number(Deno.env.get("PORT") || 8000);

export const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY") || "";

export const ARTIFACTS_PATH =
  Deno.env.get("ARTIFACTS_PATH") || "./artifacts/heads_v1.json";

export const DATA_DIR = Deno.env.get("DATA_DIR") || "./data";

export const MIN_RECORDS_FOR_WEIGHTS = 50;

export const OHLC_CACHE_TTL_MS = 5 * 60 * 1000;

export const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY") || "";

/** If set, POST /resolve and /resolve-due require header X-Resolve-Secret */
export const RESOLVE_SECRET = Deno.env.get("RESOLVE_SECRET") || "";

/**
 * Auto-run resolve-due on an interval (ms).
 * 0 or unset = disabled. Example: 86400000 = daily.
 */
export const RESOLVE_DUE_INTERVAL_MS = Number(
  Deno.env.get("RESOLVE_DUE_INTERVAL_MS") || 0,
);

/** Max predictions per auto /resolve-due pass */
export const RESOLVE_DUE_LIMIT = Math.min(
  Number(Deno.env.get("RESOLVE_DUE_LIMIT") || 20),
  50,
);
