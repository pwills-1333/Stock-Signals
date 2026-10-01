// backend/src/learning/types.ts

export interface PsiWeights {
  r: number;
  c: number;
  v: number;
  t: number;
  ch: number;
}

export interface CtrAWeights {
  temporal: number;
  recursive: number;
  fractal: number;
  psi: number;
}

/** Snapshot stored on each prediction for later weight updates */
export interface LearningSnapshot {
  psiComponents: {
    r: number;
    c: number;
    v: number;
    t: number;
    ch: number;
  };
  ctrAComponents: {
    temporal: number;
    recursive: number;
    fractal: number;
    psi: number;
  };
  expectedReturn: number;
  entryPrice: number;
  ticker: string;
}

export interface TickerErrorState {
  e: number; // recursive prediction error EMA
  n: number; // number of resolves for this ticker
  updatedAt: string;
}

export interface LearningStateFile {
  version: number;
  globalPsiWeights: PsiWeights;
  globalCtrAWeights: CtrAWeights;
  /** per-ticker recursive error state */
  tickerErrors: Record<string, TickerErrorState>;
  globalResolveCount: number;
  updatedAt: string;
}
