export const PORT = Number(Deno.env.get("PORT") || 8000);

export const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");

export const ARTIFACTS_PATH =
  Deno.env.get("ARTIFACTS_PATH") || "./artifacts/heads_v1.json";

export const DATA_DIR = Deno.env.get("DATA_DIR") || "./data";

export const MIN_RECORDS_FOR_WEIGHTS = 50;
