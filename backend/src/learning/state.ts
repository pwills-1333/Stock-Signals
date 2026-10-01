// backend/src/learning/state.ts
import { DATA_DIR } from "../config.ts";
import { clamp } from "../stats.ts";
import { withLock } from "./lock.ts";
import type {
  LearningStateFile,
  PsiWeights,
  CtrAWeights,
  TickerErrorState,
} from "./types.ts";

export const DEFAULT_PSI_WEIGHTS: PsiWeights = {
  r: 0.35,
  c: 0.25,
  v: 0.15,
  t: 0.15,
  ch: 0.10,
};

export const DEFAULT_CTRA_WEIGHTS: CtrAWeights = {
  temporal: 0.25,
  recursive: 0.35,
  fractal: 0.25,
  psi: 0.15,
};

const STATE_FILE = `${DATA_DIR}/learning_state.json`;

let cache: LearningStateFile | null = null;
let loaded = false;

function defaultState(): LearningStateFile {
  return {
    version: 1,
    globalPsiWeights: { ...DEFAULT_PSI_WEIGHTS },
    globalCtrAWeights: { ...DEFAULT_CTRA_WEIGHTS },
    tickerErrors: {},
    globalResolveCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

async function ensureDataDir(): Promise<void> {
  try {
    await Deno.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // exists
  }
}

async function loadLearningStateUnlocked(): Promise<LearningStateFile> {
  if (loaded && cache) return cache;

  await ensureDataDir();
  try {
    const text = await Deno.readTextFile(STATE_FILE);
    const parsed = JSON.parse(text) as LearningStateFile;
    cache = {
      ...defaultState(),
      ...parsed,
      globalPsiWeights: {
        ...DEFAULT_PSI_WEIGHTS,
        ...(parsed.globalPsiWeights ?? {}),
      },
      globalCtrAWeights: {
        ...DEFAULT_CTRA_WEIGHTS,
        ...(parsed.globalCtrAWeights ?? {}),
      },
      tickerErrors: parsed.tickerErrors ?? {},
    };
  } catch {
    cache = defaultState();
  }

  loaded = true;
  return cache!;
}

export async function loadLearningState(): Promise<LearningStateFile> {
  return withLock(() => loadLearningStateUnlocked());
}

export async function saveLearningState(
  state: LearningStateFile,
): Promise<void> {
  await withLock(async () => {
    await ensureDataDir();
    state.updatedAt = new Date().toISOString();
    cache = state;
    loaded = true;
    await Deno.writeTextFile(STATE_FILE, JSON.stringify(state, null, 2));
  });
}

export async function getPsiWeights(): Promise<PsiWeights> {
  const s = await loadLearningState();
  return { ...s.globalPsiWeights };
}

export async function getCtrAWeights(): Promise<CtrAWeights> {
  const s = await loadLearningState();
  return { ...s.globalCtrAWeights };
}

export async function getTickerError(ticker: string): Promise<number> {
  const s = await loadLearningState();
  const key = ticker.toUpperCase();
  return s.tickerErrors[key]?.e ?? 0;
}

export async function getTickerErrorState(
  ticker: string,
): Promise<TickerErrorState | null> {
  const s = await loadLearningState();
  return s.tickerErrors[ticker.toUpperCase()] ?? null;
}

export function normalizeWeights<T extends Record<string, number>>(
  w: T,
): T {
  const keys = Object.keys(w) as (keyof T)[];
  let sum = 0;
  for (const k of keys) {
    const v = Number(w[k]);
    sum += Number.isFinite(v) && v > 0 ? v : 0;
  }
  if (sum <= 0) return w;
  const out = { ...w };
  for (const k of keys) {
    const v = Number(w[k]);
    (out as Record<string, number>)[k as string] =
      Number.isFinite(v) && v > 0 ? v / sum : 0;
  }
  return out;
}

export function projectPsiWeights(
  w: PsiWeights,
  lo = 0.5,
  hi = 1.5,
): PsiWeights {
  const d = DEFAULT_PSI_WEIGHTS;
  const raw: PsiWeights = {
    r: clamp(w.r, d.r * lo, d.r * hi),
    c: clamp(w.c, d.c * lo, d.c * hi),
    v: clamp(w.v, d.v * lo, d.v * hi),
    t: clamp(w.t, d.t * lo, d.t * hi),
    ch: clamp(w.ch, d.ch * lo, d.ch * hi),
  };
  return normalizeWeights(raw);
}

export function projectCtrAWeights(
  w: CtrAWeights,
  lo = 0.5,
  hi = 1.5,
): CtrAWeights {
  const d = DEFAULT_CTRA_WEIGHTS;
  const raw: CtrAWeights = {
    temporal: clamp(w.temporal, d.temporal * lo, d.temporal * hi),
    recursive: clamp(w.recursive, d.recursive * lo, d.recursive * hi),
    fractal: clamp(w.fractal, d.fractal * lo, d.fractal * hi),
    psi: clamp(w.psi, d.psi * lo, d.psi * hi),
  };
  return normalizeWeights(raw);
}
