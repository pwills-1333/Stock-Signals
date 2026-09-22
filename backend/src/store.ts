// backend/src/store.ts
import type { Prediction, AccuracyRecord } from "./types.ts";

const predictions: Prediction[] = [];
const accuracy: AccuracyRecord[] = [];

export function savePrediction(p: Prediction): Prediction {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const stored: Prediction = {
    ...p,
    id,
    createdAt,
    resolved: false,
  };

  predictions.push(stored);
  return stored;
}

export function listPredictions(): Prediction[] {
  return [...predictions];
}

export function listAccuracy(): AccuracyRecord[] {
  return [...accuracy];
}

export function getOutcomes(): AccuracyRecord[] {
  return [...accuracy];
}

export function resolvePrediction(
  id: string,
  actualPrice: number,
): AccuracyRecord | null {
  const p = predictions.find((x) => x.id === id);
  if (!p) return null;

  p.resolved = true;
  p.actualPrice = actualPrice;

  if (Number.isFinite(actualPrice) && actualPrice > 0 && p.predictedPrice > 0) {
    p.errorPct = (p.predictedPrice - actualPrice) / actualPrice;
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
  return rec;
}

export function resolveAll() {
  const count = accuracy.length;
  const avgError =
    count === 0
      ? 0
      : accuracy.reduce((a, r) => a + Math.abs(r.errorPct), 0) / count;

  const hitRate =
    count === 0 ? 0 : accuracy.filter((r) => r.hit).length / count;

  return {
    count,
    avgError,
    hitRate,
  };
}
