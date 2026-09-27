// backend/scripts/calibrate.ts
/**
 * Offline calibration:
 *   actual_14d_return ≈ scale * model_score + bias
 *
 * Run from repo backend/:
 *   deno run -A scripts/calibrate.ts
 *
 * Optional env:
 *   TICKERS=AAPL,MSFT,GOOGL,AMZN,META,NVDA,TSLA,JPM,XOM,UNH
 *   LOOKBACK_DAYS=400
 *   STEP=5          # sample every N trading days
 *   HORIZON=14
 */

import { fetchYahooOHLC } from "../src/data/yahoo.ts";
import { buildFeatures } from "../src/mlFeatures.ts";
import { loadAllArtifacts } from "../artifacts/multiArtifacts.ts";
import { runAllHeads } from "../src/trainedModels.ts";
import type { OHLC } from "../src/types.ts";

const TICKERS = (Deno.env.get("TICKERS") ??
  "AAPL,MSFT,GOOGL,AMZN,META,NVDA,TSLA,JPM,XOM,UNH,AMD,NFLX,BAC,WMT,V")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const HORIZON = Number(Deno.env.get("HORIZON") ?? 14);
const STEP = Number(Deno.env.get("STEP") ?? 5);
const MIN_BARS_BEFORE = 60;

function sliceOHLC(ohlc: OHLC, endIdx: number): OHLC {
  // inclusive end at endIdx (0-based)
  return {
    t: ohlc.t.slice(0, endIdx + 1),
    o: ohlc.o.slice(0, endIdx + 1),
    h: ohlc.h.slice(0, endIdx + 1),
    l: ohlc.l.slice(0, endIdx + 1),
    c: ohlc.c.slice(0, endIdx + 1),
    v: ohlc.v.slice(0, endIdx + 1),
  };
}

function forwardReturn(closes: number[], i: number, horizon: number): number | null {
  const j = i + horizon;
  if (j >= closes.length) return null;
  const p0 = closes[i];
  const p1 = closes[j];
  if (!(p0 > 0) || !(p1 > 0)) return null;
  return (p1 - p0) / p0;
}

/** Ordinary least squares: y ≈ a*x + b */
function ols(xs: number[], ys: number[]): { a: number; b: number; n: number; r2: number } {
  const n = xs.length;
  if (n < 10) return { a: 0, b: 0, n, r2: 0 };

  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0, sumYY = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
    sumYY += y * y;
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return { a: 0, b: sumY / n, n, r2: 0 };

  const a = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - a * sumX) / n;

  // R²
  const yMean = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yHat = a * xs[i] + b;
    ssTot += (ys[i] - yMean) ** 2;
    ssRes += (ys[i] - yHat) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { a, b, n, r2 };
}

async function main() {
  console.log("Loading model artifacts...");
  const artifact = await loadAllArtifacts("artifacts");
  if (!artifact.heads?.length) {
    console.error("No heads found in artifacts/. Aborting.");
    Deno.exit(1);
  }
  console.log(`Heads: ${artifact.heads.length}`);
  console.log(`Tickers: ${TICKERS.join(", ")}`);
  console.log(`Horizon: ${HORIZON}d  |  step: ${STEP}`);

  const scores: number[] = [];
  const actuals: number[] = [];
  const perTicker: Record<string, { scores: number[]; actuals: number[] }> = {};

  for (const ticker of TICKERS) {
    console.log(`\nFetching ${ticker}...`);
    const ohlc = await fetchYahooOHLC(ticker);
    if (!ohlc || ohlc.c.length < MIN_BARS_BEFORE + HORIZON + 10) {
      console.warn(`  skip ${ticker}: insufficient bars`);
      continue;
    }

    perTicker[ticker] = { scores: [], actuals: [] };
    const closes = ohlc.c;
    let used = 0;

    // Walk history: at index i, features from [:i], label = return i → i+HORIZON
    for (
      let i = MIN_BARS_BEFORE;
      i + HORIZON < closes.length;
      i += STEP
    ) {
      const hist = sliceOHLC(ohlc, i);
      if (hist.c.length < MIN_BARS_BEFORE) continue;

      let features: number[];
      try {
        features = buildFeatures(hist);
      } catch {
        continue;
      }
      if (!features.length) continue;

      const heads = runAllHeads(artifact, features);
      if (!heads.length) continue;
      const score =
        heads.reduce((s, h) => s + h.output, 0) / heads.length;

      const ret = forwardReturn(closes, i, HORIZON);
      if (ret === null || !Number.isFinite(score) || !Number.isFinite(ret)) {
        continue;
      }

      scores.push(score);
      actuals.push(ret);
      perTicker[ticker].scores.push(score);
      perTicker[ticker].actuals.push(ret);
      used++;
    }

    console.log(`  samples: ${used}`);
    // Be kind to Yahoo
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("\n========== GLOBAL FIT ==========");
  const fit = ols(scores, actuals);
  console.log(`n = ${fit.n}`);
  console.log(`actual ≈ ${fit.a.toFixed(6)} * score + ${fit.b.toFixed(6)}`);
  console.log(`R² = ${fit.r2.toFixed(4)}`);

  if (fit.n < 30) {
    console.warn("Too few samples for a stable fit.");
    Deno.exit(0);
  }

  // Suggested head intercept adjustment: shift each intercept by bias contribution
  // If score = intercept + coef·x, and we want return ≈ a*score + b,
  // effective: return ≈ a*(raw) + b
  console.log("\n========== SUGGESTED CALIBRATION ==========");
  console.log("In trainedModels.ts scoreToReturn, use:");
  console.log(`  return ${fit.a.toFixed(6)} * score + ${fit.b.toFixed(6)};`);
  console.log("Or with a soft bound:");
  console.log(`  const raw = ${fit.a.toFixed(6)} * score + ${fit.b.toFixed(6)};`);
  console.log(`  return Math.max(-0.15, Math.min(0.15, raw));`);

  // Optional: scale intercepts only (rough)
  // new_intercept ≈ a * old_intercept + b/num_heads  is messy; prefer global affine on score.
  console.log("\nSuggested intercept scaling (multiply each head intercept by `a`,");
  console.log("then add b / num_heads to each intercept):");
  const nHeads = artifact.heads.length;
  const interceptDelta = fit.b / nHeads;
  console.log(`  scale a = ${fit.a.toFixed(6)}`);
  console.log(`  add to each intercept: ${interceptDelta.toFixed(6)}`);

  console.log("\n========== PER TICKER R² (diagnostic) ==========");
  for (const [t, d] of Object.entries(perTicker)) {
    if (d.scores.length < 15) continue;
    const f = ols(d.scores, d.actuals);
    console.log(
      `${t.padEnd(6)} n=${String(f.n).padStart(4)}  a=${f.a.toFixed(4)}  b=${f.b.toFixed(4)}  R²=${f.r2.toFixed(3)}`,
    );
  }

  console.log("\nDone. Low R² means the current heads are weak predictors;");
  console.log("the affine map still centers scale, but does not create edge.");
}

main().catch((err) => {
  console.error(err);
  Deno.exit(1);
});
