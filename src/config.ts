// Root directory inside Docker container
const ROOT = "/app";

// Unified environment accessor
const env = (key: string, fallback?: string) =>
  Deno.env.get(key) ?? fallback;

// Exported constants (single source of truth)
export const PORT = Number(env("PORT", "8000"));

export const FINNHUB_API_KEY = env("FINNHUB_API_KEY", "");
export const GOOGLE_CSE_KEY = env("GOOGLE_CSE_KEY", "");
export const GOOGLE_CSE_CX = env("GOOGLE_CSE_CX", "");
export const X_BEARER_TOKEN = env("X_BEARER_TOKEN", "");

export const ARTIFACTS_PATH = env(
  "ARTIFACTS_PATH",
  `${ROOT}/artifacts/heads_v1.json`
);

export const STORE_PATH = env(
  "STORE_PATH",
  `${ROOT}/data/store.json`
);

export const DEFAULT_SETTINGS = JSON.parse(env("DEFAULT_SETTINGS", "{}"));
export const DEFAULT_WEIGHTS = JSON.parse(env("DEFAULT_WEIGHTS", "{}"));
