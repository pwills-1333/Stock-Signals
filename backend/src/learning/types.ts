// backend/src/types.ts

export type Regime =
  | "trend"
  | "meanReversion"
  | "chaos"
  | "volatility"
  | "fundamentalBull"
  | "fundamentalBear"
  | "neutral";

export interface ModelHead {
  name: string;
  coef: number[];
  intercept: number;
}

export interface ModelArtifact {
  version: string;
  feature_count: number;
  heads: ModelHead[];
}

export interface Weights {
  markov: number;
  arimaLstm: number;
  lstm: number;
  xgb: number;
  rf: number;
}

export interface Settings {
  minReturn: number;
  minTelic: number;
  minHology: number;
  maxDissonance: number;
  minConfidence: number;
  minQuality: number;
  maxDrawdownPct: number;
  capital: number;
  mcPaths: number;
}

export interface OHLC {
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
}

export interface LearningSnapshotData {
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

export interface Prediction {
  id?: string;
  ticker: string;
  assetType: string;
  horizonDays: number;
  entryPrice: number;
  predictedPrice: number;
  expectedReturn: number;
  confidence: number;
  signal: string;
  tradeGrade: number;
  signalQuality: number;
  regime: Regime;

  ctmu: number;
  psi: number;
  bayes: number;
  ensemble: number;
  mc: number;
  garchVol: number;
  hurst: number;

  stopLoss: number;
  takeProfit: number;

  kellyPct: number;
  rationale: string;

  sentimentScore?: number;
  sentimentMagnitude?: number;
  sentimentBias?: number;

  /** Recursive learning */
  tickerError?: number;
  errorCorrection?: number;
  learningSnapshot?: LearningSnapshotData;

  resolved: boolean;
  actualPrice?: number;
  errorPct?: number;

  horizonEndDate: string;
  createdAt: string;
}

export interface AccuracyRecord {
  id?: string;
  ticker: string;
  predictionId: string;
  horizonDays: number;

  entryPrice: number;
  predictedPrice: number;
  expectedReturn: number;
  confidence: number;
  signal: string;
  tradeGrade: number;
  signalQuality: number;
  regime: Regime;

  actualPrice: number;
  errorPct: number;
  hit: boolean;

  createdAt: string;
}
