// backend/src/store.ts
import type { Prediction, AccuracyRecord } from "./types.ts";
import { DATA_DIR } from "./config.ts";
import { learnFromOutcome } from "./learning/update.ts";
import type { LearningSnapshot } from "./learning/types.ts";

const PRED_FILE = `${DATA_DIR}/predictions.json`;
const ACC_FILE = `${DATA_DIR}/accuracy.json`;

let predictions: Prediction[] = [];
let accuracy: AccuracyRecord[] = [];
let storeLoaded = false;

async function ensureDataDir(): Promise<void> {
  try {
    await Deno.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ok
  }
}

async function loadStore(): Promise<void> {
  if (storeLoaded) return;
  await ensureDataDir();
  try {
    const t = await Deno.readTextFile(PRED_FILE);
    predictions = JSON.parse(t);
  } catch {
    predictions = [];
  }
  try {
    const t = await Deno.readTextFile(ACC_FILE);
    accuracy = JSON.parse(t);
  } catch {
    accuracy = [];
  }
  storeLoaded = true;
}

async function persistStore(): Promise<void> {
  await ensureDataDir();
  await Deno.writeTextFile(PRED_FILE, JSON.stringify(predictions, null, 2));
  await Deno.writeTextFile(ACC_FILE, JSON.stringify(accuracy, null, 2));
}

export async function savePrediction(p: Prediction): Promise<Prediction> {
  await loadStore();
  const id = p.id || crypto.randomUUID();
  const createdAt = p.createdAt || new Date().toISOString();
  const stored: Prediction = {
    ...p,
    id,
    createdAt,
    resolved: false,
  };
  predictions.push(stored);
  // keep last 2000
  if (predictions.length > 2000) {
    predictions = predictions.slice(-2000);
  }
  await persistStore();
  return stored;
}

export async function listPredictions(): Promise<Prediction[]> {
  await loadStore();
  return [...predictions];
}

export async function getPrediction(
  id: string,
): Promise<Prediction | null> {
  await loadStore();
  return predictions.find((x) => x.id === id) ?? null;
}

export async function listAccuracy(): Promise<AccuracyRecord[]> {
  await loadStore();
  return [...accuracy];
}

export async function getOutcomes(): Promise<AccuracyRecord[]> {
  await loadStore();
  return [...accuracy];
}

/**
 * Resolve a prediction with actual price and run Ψ/CTR-A learning update.
 */
export async function resolvePrediction(
  id: string,
  actualPrice: number,
): Promise<AccuracyRecord | null> {
  await loadStore();
  const p = predictions.find((x) => x.id === id);
  if (!p) return null;
  if (p.resolved) {
    return accuracy.find((a) => a.predictionId === id) ?? null;
  }

  p.resolved = true;
  p.actualPrice = actualPrice;

  if (
    Number.isFinite(actualPrice) &&
    actualPrice > 0 &&
    p.entryPrice > 0
  ) {
    const actualReturn = (actualPrice - p.entryPrice) / p.entryPrice;
    p.errorPct =
      p.predictedPrice > 0
        ? (p.predictedPrice - actualPrice) / actualPrice
        : 0;

    // Recursive learning update
    if (p.learningSnapshot) {
      const snap: LearningSnapshot = {
        ...p.learningSnapshot,
        expectedReturn: p.learningSnapshot.expectedReturn,
        entryPrice: p.entryPrice,
        ticker: p.ticker,
      };
      try {
        await learnFromOutcome(snap, actualReturn);
      } catch (err) {
        console.warn("learnFromOutcome failed:", err);
      }
    }
  } else {
    p.errorPct = 0;
  }

  const hit = Math.abs(p.errorPct ?? 0) < 0.05;

  const rec: AccuracyRecord = {
    id: crypto.randomUUID(),
    ticker: p.ticker,
    predictionId: id,
    horizonDays: p.horizonDays,
    entryPrice: p.entryPrice,
    predictedPrice: p.predictedPrice,
    expectedReturn: p.expectedReturn,
    confidence: p.confidence,
    signal: p.signal,
    tradeGrade: p.tradeGrade,
    signalQuality: p.signalQuality,
    regime: p.regime,
    actualPrice,
    errorPct: p.errorPct ?? 0,
    hit,
    createdAt: new Date().toISOString(),
  };

  accuracy.push(rec);
  if (accuracy.length > 2000) {
    accuracy = accuracy.slice(-2000);
  }
  await persistStore();
  return rec;
}

export async function resolveAllStats() {
  await loadStore();
  const count = accuracy.length;
  const avgError =
    count === 0
      ? 0
      : accuracy.reduce((a, r) => a + Math.abs(r.errorPct), 0) / count;
  const hitRate =
    count === 0 ? 0 : accuracy.filter((r) => r.hit).length / count;
  return { count, avgError, hitRate };
}
