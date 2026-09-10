import { DATA_DIR, MIN_RECORDS_FOR_WEIGHTS } from "./config.ts";
import type { AccuracyRecord, Prediction, Settings, Weights } from

"./types.ts";
import { DEFAULT_SETTINGS, DEFAULT_WEIGHTS } from "./config.ts";

async function ensureDir() {
try {
await Deno.mkdir(DATA_DIR, { recursive: true });
} catch { /* exists */ }
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
await ensureDir();
try {
const t = await Deno.readTextFile(`${DATA_DIR}/${name}`);
return JSON.parse(t) as T;
} catch {
return fallback;
}

}

async function writeJson(name: string, data: unknown) {
await ensureDir();
await Deno.writeTextFile(`${DATA_DIR}/${name}`, JSON.stringify(data,
null, 2));
}

function id() {
return crypto.randomUUID();
}

export async function savePrediction(p: Prediction):
Promise<Prediction> {
const list = await readJson<Prediction[]>("predictions.json",
[]);
const row = { ...p, id: p.id || id(), createdAt: p.createdAt || new
Date().toISOString() };
list.unshift(row);
await writeJson("predictions.json", list.slice(0, 5000));
return row;
}

export async function listPredictions() {
return readJson<Prediction[]>("predictions.json", []);
}

export async function updatePrediction(pid: string, patch:
Partial<Prediction>) {
const list = await listPredictions();
const i = list.findIndex((x) => x.id === pid);
if (i < 0) return null;
list[i] = { ...list[i], ...patch };
await writeJson("predictions.json", list);
return list[i];
}

export async function saveAccuracy(r: AccuracyRecord) {
const list = await readJson<AccuracyRecord[]>("accuracy.json",
[]);
const row = { ...r, id: r.id || id(), createdAt: r.createdAt || new
Date().toISOString() };
list.unshift(row);
await writeJson("accuracy.json", list.slice(0, 5000));
return row;
}

export async function listAccuracy() {
return readJson<AccuracyRecord[]>("accuracy.json", []);
}

export async function getSettings(): Promise<Settings> {
const s = await readJson<Partial<Settings>>("settings.json", {});
const meta = await readJson<{ thresholds?: Partial<Settings>
}>("metaconfig.json", {});
return { ...DEFAULT_SETTINGS, ...s, ...(meta.thresholds || {}) };
}

export async function getWeights(): Promise<Weights> {
const mw = await readJson<Weights | null>("weights.json", null);
if (!mw) return { ...DEFAULT_WEIGHTS };
const acc = await listAccuracy();
if (acc.length < MIN_RECORDS_FOR_WEIGHTS) return { ...DEFAULT_WEIGHTS
};

return mw;
}

export async function saveWeights(w: Weights) {
await writeJson("weights.json", { ...w, updatedAt: new
Date().toISOString() });
}

export async function saveMetaConfig(meta: { thresholds?:
Partial<Settings>; accuracy?: number }) {
await writeJson("metaconfig.json", { ...meta, version: Date.now() });
}
