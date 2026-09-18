export type Regime = "trend" | "meanReversion" | "chaos";

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
