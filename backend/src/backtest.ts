// backend/src/backtest.ts
/**
 * MVP historical walk-forward backtest.
 * - Point-in-time OHLC only (no bars after as-of)
 * - Sentiment disabled (no historical news archive)
 * - Does NOT write learning state or predictions store
 * - Artifact + learning weights loaded once per run
 */
import type { OHLC, Regime } from "./types.ts";
import { fetchOHLC } from "./data.ts";
import { buildFeatures } from "./mlFeatures.ts";
import { loadAllArtifacts } from "../artifacts/multiArtifacts.ts";
import { runAllHeads, aggregateHeads } from "./trainedModels.ts";
import {
  detectRegime,
  weightHeadsByRegime,
  applyHeadWeights,
} from "./regimeSelector.ts";
import { computeFractalSignal } from "./fractal.ts";
import { atr } from "./stats.ts";
import { computeAdaptivePsi } from "./psi/adaptivePsi.ts";
import { computeCtrA } from "./ctmu/ctrA.ts";
import {
  getPsiWeights,
  getCtrAWeights,
  getTickerError,
  DEFAULT_PSI_WEIGHTS,
  DEFAULT_CTRA_WEIGHTS,
} from "./learning/state.ts";
import type { PsiWeights, CtrAWeights } from "./learning/types.ts";

export interface BacktestTrade {
  asOfIndex: number;
  asOfDate: string | null;
  entryPrice: number;
  horizonDays: number;
  predictedReturn: number;
  actualReturn: number;
  error: number;
  absError: number;
  signal: string;
  actualDirection: "up" | "down" | "flat";
  /** null = neutral signal (excluded from directional accuracy) */
  directionHit: boolean | null;
  confidence: number;
  regime: Regime | string;
  hurst: number;
  chaos: number;
  psi: number;
  ctrA: number;
}

export interface BacktestSummary {
  ticker: string;
  horizonDays: number;
  stepDays: number;
  trades: number;
  /** All trades including neutral (neutral excluded from this rate) */
  directionAccuracy: number;
  /** Buy/sell only */
  directionalTrades: number;
  meanAbsError: number;
  meanError: number;
  hitRate5pct: number;
  bySignal: Record<string, { n: number; dirAcc: number; mae: number }>;
  byRegime: Record<string, { n: number; dirAcc: number; mae: number }>;
  sample: BacktestTrade[];
  notes: string[];
}

export interface BacktestOpts {
  ticker: string;
  horizonDays?: number;
  stepDays?: number;
  minBars?: number;
  maxTrades?: number;
  freezeLearning?: boolean;
}

function sliceOhlc(ohlc: OHLC, endInclusive: number): OHLC {
  const n = endInclusive + 1;
  return {
    t: Array.isArray(ohlc.t) ? ohlc.t.slice(0, n) : [],
    o: ohlc.o.slice(0, n),
    h: ohlc.h.slice(0, n),
    l: ohlc.l.slice(0, n),
    c: ohlc.c.slice(0, n),
    v: Array.isArray(ohlc.v) ? ohlc.v.slice(0, n) : [],
  };
}

function barDate(ohlc: OHLC, index: number): string | null {
  const ts = ohlc.t?.[index];
  if (!Number.isFinite(ts)) return null;
  // Finnhub/Yahoo: unix seconds; guard if ms
  const ms = ts! < 1e12 ? ts! * 1000 : ts!;
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function direction(x: number): "up" | "down" | "flat" {
  if (x > 0.001) return "up";
  if (x < -0.001) return "down";
  return "flat";
}

function signalDirection(signal: string): "up" | "down" | "flat" {
  const s = (signal || "").toLowerCase();
  if (s === "buy") return "up";
  if (s === "sell") return "down";
  return "flat";
}

/**
 * Directional hit:
 * - buy/sell: must match actual up/down
 * - neutral: excluded (null) so they do not tank accuracy
 */
function computeDirectionHit(
  signal: string,
  actualReturn: number,
): boolean | null {
  const sigDir = signalDirection(signal);
  if (sigDir === "flat") return null;
  return sigDir === direction(actualReturn);
}

type Artifact = Awaited<ReturnType<typeof loadAllArtifacts>>;

async function predictOnWindow(input: {
  ticker: string;
  ohlc: OHLC;
  artifact: NonNullable<Artifact>;
  psiWeights: PsiWeights;
  ctrAWeights: CtrAWeights;
  tickerError: number;
}): Promise<{
  expectedReturn: number;
  confidence: number;
  signal: string;
  regime: Regime | string;
  hurst: number;
  chaos: number;
  psi: number;
  ctrA: number;
  entryPrice: number;
} | null> {
  const { ticker, ohlc, artifact, psiWeights, ctrAWeights, tickerError } =
    input;
  const closes = ohlc.c;
  if (!closes || closes.length < 50) return null;

  const entryPrice = closes[closes.length - 1];
  if (!(entryPrice > 0)) return null;

  const features = buildFeatures(ohlc);
  if (!artifact.heads?.length) return null;

  const headOutputs = runAllHeads(artifact, features);
  const rawAgg = aggregateHeads(headOutputs);

  const fractal = computeFractalSignal(closes);
  const atr14 = atr(ohlc.h, ohlc.l, ohlc.c, 14);
  const volatility = entryPrice > 0 ? atr14 / entryPrice : 0;

  const chaosScore =
    typeof fractal.chaos === "number"
      ? Math.max(0, Math.min(1, fractal.chaos))
      : fractal.chaos
      ? 0.6
      : 0.1;

  const regimeInputs = {
    expectedReturn: rawAgg.expectedReturn,
    confidence: rawAgg.confidence,
    hurst: fractal.hurst,
    volatility,
    chaos: chaosScore,
    ctrA: rawAgg.expectedReturn,
  };

  const regime = detectRegime(regimeInputs) as Regime;
  const headWeights = weightHeadsByRegime(regime, artifact.heads);
  const weightedOutputs = applyHeadWeights(headOutputs, headWeights);
  const agg = aggregateHeads(weightedOutputs);

  let expectedReturn = agg.expectedReturn;
  let confidence = agg.confidence;
  let signal = agg.signal;

  const psiOut = await computeAdaptivePsi({
    expectedReturn,
    confidence,
    volatility,
    closes,
    weights: psiWeights,
  });

  const ctrAOut = await computeCtrA({
    closes,
    expectedReturn,
    confidence,
    psi: psiOut.psi,
    ticker,
    weights: ctrAWeights,
    tickerError,
  });

  const ctrAReturnBias = Math.max(-0.05, Math.min(0.05, ctrAOut.ctrA * 0.03));
  expectedReturn = expectedReturn + ctrAReturnBias;

  const stabilityBoost =
    0.85 + 0.15 * Math.min(1, Math.abs(ctrAOut.stability ?? 0.5));
  confidence = Math.min(
    1,
    Math.max(0, (confidence * 0.55 + psiOut.grade * 0.45) * stabilityBoost),
  );

  if (psiOut.signal === "buy" && signal === "neutral") signal = "buy";
  if (psiOut.signal === "sell" && signal === "neutral") signal = "sell";

  expectedReturn = Math.max(-0.15, Math.min(0.15, expectedReturn));

  return {
    expectedReturn,
    confidence,
    signal,
    regime,
    hurst: fractal.hurst,
    chaos: chaosScore,
    psi: psiOut.psi,
    ctrA: ctrAOut.ctrA,
    entryPrice,
  };
}

function emptyBucket() {
  return { n: 0, dirHits: 0, dirN: 0, absErrSum: 0 };
}

function finalizeBucket(v: ReturnType<typeof emptyBucket>) {
  return {
    n: v.n,
    dirAcc: v.dirN > 0 ? v.dirHits / v.dirN : 0,
    mae: v.n > 0 ? v.absErrSum / v.n : 0,
  };
}

/**
 * Walk-forward: prefer **recent** history, point-in-time features only.
 */
export async function backtestWalkForward(
  opts: BacktestOpts,
): Promise<BacktestSummary> {
  const ticker = (opts.ticker || "").toUpperCase().trim();
  const horizonDays = Math.max(1, Math.min(30, opts.horizonDays ?? 5));
  const stepDays = Math.max(1, Math.min(20, opts.stepDays ?? 5));
  const minBars = Math.max(50, opts.minBars ?? 60);
  const maxTrades = Math.max(1, Math.min(100, opts.maxTrades ?? 40));
  const freezeLearning = opts.freezeLearning !== false;

  const notes: string[] = [
    "OHLC point-in-time only; sentiment disabled.",
    "horizonDays/stepDays are trading bars (not calendar days).",
    "Live Analyze uses horizonDays=14; backtest default is 5 bars.",
    "Neutral signals excluded from direction accuracy.",
    "Evaluates most recent eligible windows first.",
  ];

  const empty = (): BacktestSummary => ({
    ticker,
    horizonDays,
    stepDays,
    trades: 0,
    directionAccuracy: 0,
    directionalTrades: 0,
    meanAbsError: 0,
    meanError: 0,
    hitRate5pct: 0,
    bySignal: {},
    byRegime: {},
    sample: [],
    notes,
  });

  const ohlc = await fetchOHLC(ticker);
  if (!ohlc?.c?.length) return empty();

  // Load once per run (major speed fix)
  const artifact = await loadAllArtifacts("artifacts");
  if (!artifact || !artifact.heads?.length) {
    notes.push("No model artifacts found.");
    return empty();
  }

  let psiWeights = { ...DEFAULT_PSI_WEIGHTS };
  let ctrAWeights = { ...DEFAULT_CTRA_WEIGHTS };
  let tickerError = 0;

  if (!freezeLearning) {
    try {
      const [pw, cw, et] = await Promise.all([
        getPsiWeights(),
        getCtrAWeights(),
        getTickerError(ticker),
      ]);
      psiWeights = pw;
      ctrAWeights = cw;
      tickerError = et;
      notes.push("Using live learning weights (read-only).");
    } catch {
      notes.push("Learning state read failed; using defaults.");
    }
  } else {
    notes.push("Learning weights frozen at defaults.");
  }

  const n = ohlc.c.length;
  const lastAsOf = n - 1 - horizonDays;
  const trades: BacktestTrade[] = [];

  // Walk backward from most recent valid as-of so maxTrades hits recent history
  for (
    let i = lastAsOf;
    i >= minBars - 1 && trades.length < maxTrades;
    i -= stepDays
  ) {
    const window = sliceOhlc(ohlc, i);
    const pred = await predictOnWindow({
      ticker,
      ohlc: window,
      artifact,
      psiWeights,
      ctrAWeights,
      tickerError,
    });
    if (!pred) continue;

    const futureClose = ohlc.c[i + horizonDays];
    if (!(futureClose > 0) || !(pred.entryPrice > 0)) continue;

    const actualReturn = futureClose / pred.entryPrice - 1;
    const error = pred.expectedReturn - actualReturn;
    const actualDir = direction(actualReturn);
    const directionHit = computeDirectionHit(pred.signal, actualReturn);

    trades.push({
      asOfIndex: i,
      asOfDate: barDate(ohlc, i),
      entryPrice: pred.entryPrice,
      horizonDays,
      predictedReturn: pred.expectedReturn,
      actualReturn,
      error,
      absError: Math.abs(error),
      signal: pred.signal,
      actualDirection: actualDir,
      directionHit,
      confidence: pred.confidence,
      regime: pred.regime,
      hurst: pred.hurst,
      chaos: pred.chaos,
      psi: pred.psi,
      ctrA: pred.ctrA,
    });
  }

  // Chronological order for sample display
  trades.reverse();

  const m = trades.length;
  if (m === 0) return empty();

  let dirHits = 0;
  let dirN = 0;
  let absSum = 0;
  let errSum = 0;
  let hit5 = 0;
  const sigMap: Record<string, ReturnType<typeof emptyBucket>> = {};
  const regMap: Record<string, ReturnType<typeof emptyBucket>> = {};

  for (const t of trades) {
    absSum += t.absError;
    errSum += t.error;
    if (t.absError < 0.05) hit5++;

    if (t.directionHit !== null) {
      dirN++;
      if (t.directionHit) dirHits++;
    }

    const sk = t.signal || "neutral";
    if (!sigMap[sk]) sigMap[sk] = emptyBucket();
    sigMap[sk].n++;
    sigMap[sk].absErrSum += t.absError;
    if (t.directionHit !== null) {
      sigMap[sk].dirN++;
      if (t.directionHit) sigMap[sk].dirHits++;
    }

    const rk = String(t.regime || "neutral");
    if (!regMap[rk]) regMap[rk] = emptyBucket();
    regMap[rk].n++;
    regMap[rk].absErrSum += t.absError;
    if (t.directionHit !== null) {
      regMap[rk].dirN++;
      if (t.directionHit) regMap[rk].dirHits++;
    }
  }

  const bySignal: BacktestSummary["bySignal"] = {};
  for (const [k, v] of Object.entries(sigMap)) {
    bySignal[k] = finalizeBucket(v);
  }
  const byRegime: BacktestSummary["byRegime"] = {};
  for (const [k, v] of Object.entries(regMap)) {
    byRegime[k] = finalizeBucket(v);
  }

  return {
    ticker,
    horizonDays,
    stepDays,
    trades: m,
    directionAccuracy: dirN > 0 ? dirHits / dirN : 0,
    directionalTrades: dirN,
    meanAbsError: absSum / m,
    meanError: errSum / m,
    hitRate5pct: hit5 / m,
    bySignal,
    byRegime,
    sample: trades.slice(-15),
    notes,
  };
}
