// backend/src/store.ts
import type { Prediction, AccuracyRecord } from "./types.ts";
import { DATA_DIR } from "./config.ts";
import { learnFromOutcome } from "./learning/update.ts";
import type { LearningSnapshot } from "./learning/types.ts";
import { withLock } from "./learning/lock.ts";

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

async function loadStoreUnlocked(): Promise<void> {
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

async function persistStoreUnlocked(): Promise<void> {
  await ensureDataDir();
  await Deno.writeTextFile(PRED_FILE, JSON.stringify(predictions, null, 2));
  await Deno.writeTextFile(ACC_FILE, JSON.stringify(accuracy, null, 2));
}

export async function savePrediction(p: Prediction): Promise<Prediction> {
  return withLock(async () => {
    await loadStoreUnlocked();
    const id = p.id || crypto.randomUUID();
    const createdAt = p.createdAt || new Date().toISOString();
    const stored: Prediction = {
      ...p,
      id,
      createdAt,
      resolved: false,
    };
    predictions.push(stored);
    if (predictions.length > 2000) {
      predictions = predictions.slice(-2000);
    }
    await persistStoreUnlocked();
    return stored;
  });
}

export async function listPredictions(): Promise<Prediction[]> {
  return withLock(async () => {
    await loadStoreUnlocked();
    return [...predictions];
  });
}

export async function getPrediction(
  id: string,
): Promise<Prediction | null> {
  return withLock(async () => {
    await loadStoreUnlocked();
    return predictions.find((x) => x.id === id) ?? null;
  });
}

export async function listAccuracy(): Promise<AccuracyRecord[]> {
  return withLock(async () => {
    await loadStoreUnlocked();
    return [...accuracy];
  });
}

export async function getOutcomes(): Promise<AccuracyRecord[]> {
  return withLock(async () => {
    await loadStoreUnlocked();
    return [...accuracy];
  });
}

export async function resolvePrediction(
  id: string,
  actualPrice: number,
): Promise<AccuracyRecord | null> {
  // Snapshot for learning outside lock where possible; mutate under lock
  let snap: LearningSnapshot | null = null;
  let entryPrice = 0;
  let ticker = "";
  let expectedReturnForLearn = 0;

  const rec = await withLock(async () => {
    await loadStoreUnlocked();
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
      p.errorPct =
        p.predictedPrice > 0
          ? (p.predictedPrice - actualPrice) / actualPrice
          : 0;

      if (p.learningSnapshot) {
        snap = {
          ...p.learningSnapshot,
          expectedReturn: p.learningSnapshot.expectedReturn,
          entryPrice: p.entryPrice,
          ticker: p.ticker,
        };
        entryPrice = p.entryPrice;
        ticker = p.ticker;
        expectedReturnForLearn = p.learningSnapshot.expectedReturn;
      }
    } else {
      p.errorPct = 0;
    }

    const hit = Math.abs(p.errorPct ?? 0) < 0.05;

    const record: AccuracyRecord = {
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

    accuracy.push(record);
    if (accuracy.length > 2000) {
      accuracy = accuracy.slice(-2000);
    }
    await persistStoreUnlocked();
    return record;
  });

  if (snap && entryPrice > 0) {
    const actualReturn = (actualPrice - entryPrice) / entryPrice;
    try {
      await learnFromOutcome(snap, actualReturn);
    } catch (err) {
      console.warn("learnFromOutcome failed:", err);
    }
  }

  return rec;
}

export async function resolveAllStats() {
  return withLock(async () => {
    await loadStoreUnlocked();
    const count = accuracy.length;
    const avgError =
      count === 0
        ? 0
        : accuracy.reduce((a, r) => a + Math.abs(r.errorPct), 0) / count;
    const hitRate =
      count === 0 ? 0 : accuracy.filter((r) => r.hit).length / count;
    return { count, avgError, hitRate };
  });
}
