import { ARTIFACTS_PATH } from "./config.ts";

let artifacts: any = null;

export async function loadModelArtifacts() {
  if (artifacts) return artifacts;

  try {
    const raw = await Deno.readTextFile(ARTIFACTS_PATH);
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Artifacts JSON malformed");
    }

    artifacts = parsed;
    console.log("Loaded model artifacts:", ARTIFACTS_PATH);
    return artifacts;

  } catch (err) {
    console.error("Failed to load model artifacts:", err);
    artifacts = {
      heads: [],
      fallback: true
    };
    return artifacts;
  }
}

export function runModels(features: number[]) {
  if (!artifacts || artifacts.fallback) {
    return {
      expectedReturn: 0,
      confidence: 0,
      signal: "neutral",
      heads: []
    };
  }

  if (!Array.isArray(features) || features.some((x) => !Number.isFinite(x))) {
    return {
      expectedReturn: 0,
      confidence: 0,
      signal: "neutral",
      heads: [],
      error: "Invalid feature vector"
    };
  }

  const results: any[] = [];

  for (const head of artifacts.heads ?? []) {
    if (!head?.coef || !head?.intercept) continue;

    let y = head.intercept;
    for (let i = 0; i < head.coef.length && i < features.length; i++) {
      y += head.coef[i] * features[i];
    }

    results.push({
      name: head.name ?? "unnamed",
      output: y
    });
  }

  const avg = results.length
    ? results.reduce((a, b) => a + b.output, 0) / results.length
    : 0;

  return {
    expectedReturn: avg,
    confidence: Math.min(Math.abs(avg), 1),
    signal: avg > 0 ? "buy" : avg < 0 ? "sell" : "neutral",
    heads: results
  };
}
