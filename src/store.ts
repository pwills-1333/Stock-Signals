import { STORE_PATH, DEFAULT_WEIGHTS, DEFAULT_SETTINGS } from "./config.ts";
import type { Prediction, AccuracyRecord, Weights, Settings } from "./types.ts";

async function ensureDir() {
  try {
    await Deno.mkdir("./data", { recursive: true });
  } catch { /* exists */ }
}

async function readStore(): Promise<any> {
  await ensureDir();
  try {
    const text = await Deno.readTextFile(STORE_PATH);
    return JSON.parse(text);
  } catch {
    return { predictions: [], accuracy: [], weights: DEFAULT_WEIGHTS, settings: DEFAULT_SETTINGS };
  }
}

async function writeStore(data: any) {
  await ensureDir();
  await Deno.writeTextFile(STORE_PATH, JSON.stringify(data, null, 2));
}

export async function savePrediction(p: Prediction): Promise<Prediction> {
  const store = await readStore();
  p.id = crypto.randomUUID();
  store.predictions.push(p);
  await writeStore(store);
  return p;
}

export async function listPredictions(): Promise<Prediction[]> {
  const store = await readStore();
  return store.predictions || [];
}

export async function updatePrediction(id: string, patch: Partial<Prediction>) {
  const store = await readStore();
  const idx = store.predictions.findIndex((x: Prediction) => x.id === id);
  if (idx >= 0) {
    store.predictions[idx] = { ...store.predictions[idx], ...patch };
    await writeStore(store);
  }
}

export async function saveAccuracy(rec: AccuracyRecord) {
  const store = await readStore();
  rec.id = crypto.randomUUID();
  store.accuracy.push(rec);
  await writeStore(store);
}

export async function listAccuracy(): Promise<AccuracyRecord[]> {
  const store = await readStore();
  return store.accuracy || [];
}

export async function getWeights(): Promise<Weights> {
  const store = await readStore();
  return store.weights || DEFAULT_WEIGHTS;
}

export async function saveWeights(w: Weights) {
  const store = await readStore();
  store.weights = w;
  await writeStore(store);
}

export async function getSettings(): Promise<Settings> {
  const store = await readStore();
  return { ...DEFAULT_SETTINGS, ...(store.settings || {}) };
}
