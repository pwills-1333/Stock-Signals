export const config = {
  port: Number(process.env.PORT) || 8000,
  finnhubApiKey: process.env.FINNHUB_API_KEY || "",
  googleCseKey: process.env.GOOGLE_CSE_KEY || "",
  googleCseCx: process.env.GOOGLE_CSE_CX || "",
  xBearerToken: process.env.X_BEARER_TOKEN || "",
  artifactsPath: process.env.ARTIFACTS_PATH || "./artifacts/heads_v1.json",
  dataDir: process.env.DATA_DIR || "./data",
  storePath: process.env.STORE_PATH || "./data/store.json",
};
export const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");
export const GOOGLE_CSE_KEY = Deno.env.get("GOOGLE_CSE_KEY");
export const GOOGLE_CSE_CX = Deno.env.get("GOOGLE_CSE_CX");
export const X_BEARER_TOKEN = Deno.env.get("X_BEARER_TOKEN");
export const ARTIFACTS_PATH =
  Deno.env.get("ARTIFACTS_PATH") || "../artifacts/heads_v1.json";
export const DEFAULT_SETTINGS = Deno.env.get("DEFAULT_SETTINGS");
export const DEFAULT_WEIGHTS = Deno.env.get("DEFAULT_WEIGHTS");
export const STORE_PATH = Deno.env.get("STORE_PATH");
export const PORT = Number(Deno.env.get("PORT")) || 8000;
