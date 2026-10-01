// backend/src/store.ts
import type { Prediction, AccuracyRecord } from "./types.ts";
import { DATA_DIR } from "./config.ts";
import { learnFromOutcome } from "./learning/update.ts";
import type { LearningSnapshot } from "./learning/types.ts";
import { withLock } from "./learning/lock.ts";
import { fetchOHLC } from "./data.ts";

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
  let snap: LearningSnapshot | null = null;
  let entryPrice = 0;

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

/**
 * Resolve all unresolved predictions whose horizon has ended.
 * Fetches latest close per ticker. Caps work per call.
 */
export async function resolveDuePredictions(opts?: {
  limit?: number;
  slackMs?: number;
}): Promise<{
  attempted: number;
  resolved: number;
  failed: string[];
}> {
  const limit = Math.min(opts?.limit ?? 20, 50);
  const slackMs = opts?.slackMs ?? 6 * 60 * 60 * 1000;
  const now = Date.now();

  const due = await withLock(async () => {
    await loadStoreUnlocked();
    return predictions
      .filter((p) => {
        if (p.resolved || !p.id) return false;
        const h = Date.parse(p.horizonEndDate || "");
        return Number.isFinite(h) && now + slackMs >= h;
      })
      .slice(0, limit)
      .map((p) => ({ id: p.id!, ticker: p.ticker }));
  });

  let resolved = 0;
  const failed: string[] = [];

  for (const item of due) {
    try {
      const ohlc = await fetchOHLC(item.ticker);
      const price = ohlc?.c?.length ? ohlc.c[ohlc.c.length - 1] : 0;
      if (!(price > 0)) {
        failed.push(`${item.id}:${item.ticker}:no-price`);
        continue;
      }
      const rec = await resolvePrediction(item.id, price);
      if (rec) resolved++;
      else failed.push(`${item.id}:${item.ticker}:resolve-null`);
    } catch (err) {
      failed.push(
        `${item.id}:${item.ticker}:${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return { attempted: due.length, resolved, failed };
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
