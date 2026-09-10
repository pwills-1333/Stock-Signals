export type Regime = "trend" | "meanReversion" | "chaos";
export type Weights = {
markov: number;
arimaLstm: number;
lstm: number;
xgb: number;
rf: number;
};

export type Settings = {
minReturn: number;
minTelic: number;
minHology: number;
maxDissonance: number;
minConfidence: number;
minQuality: number;
maxDrawdownPct: number;
capital: number;
mcPaths: number;
};

export type OHLC = {
t: number[];
o: number[];
h: number[];
l: number[];
c: number[];
v: number[];
};

export type Prediction = {
id?: string;
ticker: string;
assetType: string;
horizonDays: number;
entryPrice: number;
predictedPrice: number;
expectedReturn: number;
confidence: number;
signal: string;
tradeGrade: string;
signalQuality: number;
regime: Regime;
ctmu: { telic: number; hology: number; dissonance: number; mode: string
};

psi: { s: number; e: number; c: number; m: number; t: number; scalar:
number };
bayes: { prior: number; likelihood: number; posterior: number };
ensemble: Record<string, unknown>;
mc: { mean: number; p5: number; p95: number };
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
};

export type AccuracyRecord = {
id?: string;
ticker: string;
predictionId: string;
horizonDays: number;
entryPrice: number;
predictedPrice: number;
expectedReturn: number;
confidence: number;
signal: string;
tradeGrade: string;
signalQuality: number;
regime: string;
actualPrice: number;
errorPct: number;
hit: boolean;
createdAt: string;
};
