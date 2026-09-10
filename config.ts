export const DEFAULT_WEIGHTS = {
markov: 0.15,
arimaLstm: 0.28,
lstm: 0.22,
xgb: 0.20,
rf: 0.15,
};

export const DEFAULT_SETTINGS = {
minReturn: 0.015,
minTelic: 0.35,
minHology: 0.4,
maxDissonance: 0.5,
minConfidence: 0.45,
minQuality: 0.4,
maxDrawdownPct: 0.15,
capital: 10_000,
mcPaths: 2000,
};

export const PORT = Number(Deno.env.get("PORT") || 8000);
// No hard-coded fallback -- set FINNHUB_API_KEY in your .env file.
export const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY") || "";
export const ARTIFACTS_PATH =
Deno.env.get("ARTIFACTS_PATH") || "./artifacts/heads_v1.json";
export const DATA_DIR = Deno.env.get("DATA_DIR") || "./data";
export const MIN_RECORDS_FOR_WEIGHTS = 50;
