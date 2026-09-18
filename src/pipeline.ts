import { fetchYahooData, fetchFinnhubData } from "./yahoo.ts";
import { fetchNews } from "./news.ts";
import { fetchXPosts } from "./xposts.ts";
import { buildFeatures } from "./mlFeatures.ts";
import { runModels } from "./trainedModels.ts";
import { computeFractalRegime } from "./fractal.ts";
import { computePsi } from "./adaptivePsi.ts";
import { computeKelly } from "./optimizer.ts";
import { generateRationale } from "./formulas.ts";

export async function predict(input: any) {
  if (!input || typeof input.ticker !== "string") {
    return { error: "Invalid request: missing ticker" };
  }

  const ticker = input.ticker.toUpperCase();
  console.log(`Pipeline start for ${ticker}`);

  try {
    // -----------------------------
    // 1. Fetch OHLC data
    // -----------------------------
    let ohlc = await fetchYahooData(ticker).catch(() => null);
    if (!ohlc) {
      ohlc = await fetchFinnhubData(ticker).catch(() => null);
    }
    if (!ohlc) {
      return { error: "No OHLC data available for ticker" };
    }

    // -----------------------------
    // 2. Fetch news + sentiment
    // -----------------------------
    const news = await fetchNews(ticker).catch(() => []);
    const posts = await fetchXPosts(ticker).catch(() => []);

    // -----------------------------
    // 3. Build feature vector
    // -----------------------------
    const features = buildFeatures(ohlc);
    if (!Array.isArray(features) || features.length === 0) {
      return { error: "Feature generation failed" };
    }

    // -----------------------------
    // 4. Run ML heads
    // -----------------------------
    const modelOutput = await runModels(features).catch(() => null);
    if (!modelOutput) {
      return { error: "Model inference failed" };
    }

    // -----------------------------
    // 5. Compute fractal regime
    // -----------------------------
    const regime = computeFractalRegime(ohlc);

    // -----------------------------
    // 6. Compute Ψ adaptive score
    // -----------------------------
    const psi = computePsi(features, modelOutput);

    // -----------------------------
    // 7. Compute Kelly sizing
    // -----------------------------
    const kelly = computeKelly(modelOutput);

    // -----------------------------
    // 8. Generate rationale
    // -----------------------------
    const rationale = generateRationale({
      ticker,
      regime,
      psi,
      kelly,
      modelOutput,
      news,
      posts
    });

    // -----------------------------
    // 9. Final normalized output
    // -----------------------------
    return {
      ticker,
      regime,
      psi,
      kelly,
      expectedReturn: modelOutput.expectedReturn ?? 0,
      confidence: modelOutput.confidence ?? 0,
      signal: modelOutput.signal ?? "neutral",
      rationale,
      features,
      models: modelOutput,
      news,
      sentiment: posts
    };

  } catch (err) {
    console.error("Pipeline error:", err);
    return {
      error: "Pipeline failed",
      details: err instanceof Error ? err.message : String(err)
    };
  }
}
