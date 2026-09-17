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
