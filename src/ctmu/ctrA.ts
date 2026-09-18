import { clamp } from "../stats.ts";

export interface Event {
  id: string;
  time: number;
  state: string;
  meaning: string;
  prediction?: number;
  context: string;
  value?: number; // numeric payload (return, volume spike, sentiment…)
}

export interface CTRAResult {
  R: number;          // Reality Coherence
  GI: number;         // Global Integration
  RC: number;         // Recursive Coherence
  LCS: Record<string, number>;
  meaningScore: number;
  selfModel: boolean;
  mode: string;
  telic: number;
  hology: number;
  dissonance: number;
}

function temporalCoherence(t1: number, t2: number): number {
  return 1 / (1 + Math.abs(t1 - t2) / 86400000); // scale by day
}

function structuralCoherence(a: Event, b: Event): number {
  if (a.context === b.context) return 0.9;
  if (a.state === b.state) return 0.6;
  return 0.2;
}

function semanticCoherence(a: Event, b: Event): number {
  const ma = a.meaning.toLowerCase();
  const mb = b.meaning.toLowerCase();
  if (ma === mb) return 1;
  if (ma.includes(mb) || mb.includes(ma)) return 0.7;
  return 0.15;
}

function harmonicCoherence(a: Event, b: Event): number {
  if (a.value === undefined || b.value === undefined) return 0;
  const sameSign = Math.sign(a.value) === Math.sign(b.value);
  return sameSign ? 0.8 : -0.4;
}

function predictiveCoherence(a: Event, b: Event): number {
  if (a.prediction === undefined || b.value === undefined) return 0.5;
  const err = Math.abs(a.prediction - b.value);
  return clamp(1 - err * 3, 0, 1);
}

export function runCTRA(events: Event[]): CTRAResult {
  if (events.length < 2) {
    return {
      R: 0.3, GI: 0.3, RC: 0, LCS: {}, meaningScore: 0.2,
      selfModel: false, mode: "sparse", telic: 0.3, hology: 0.3, dissonance: 0.5,
    };
  }

  const n = events.length;
  const edges: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  let totalWeight = 0;
  let edgeCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const tc = temporalCoherence(events[i].time, events[j].time);
      const sc = structuralCoherence(events[i], events[j]);
      const sem = semanticCoherence(events[i], events[j]);
      const hc = harmonicCoherence(events[i], events[j]);
      const pc = predictiveCoherence(events[i], events[j]);
      const rd = (tc + sc + sem + hc + pc) / 5;
      edges[i][j] = edges[j][i] = rd;
      totalWeight += rd;
      edgeCount++;
    }
  }

  const GI = edgeCount ? totalWeight / edgeCount : 0;

  // Local Coherence Scores
  const LCS: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) if (i !== j) sum += edges[i][j];
    LCS[events[i].id] = sum;
  }

  // Simple recursive coherence proxy (self-referential loops via high mutual edges)
  let RC = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (edges[i][j] > 0.7 && LCS[events[i].id] > 1.5 && LCS[events[j].id] > 1.5) {
        RC += 0.15;
      }
    }
  }
  RC = clamp(RC, 0, 2);

  const meaningScore = GI * (0.6 + 0.4 * Math.min(1, events.length / 12));
  const selfModel = RC > 0.4 && GI > 0.55;

  // Map to original CTMU-style fields
  const telic = clamp(GI * 0.7 + RC * 0.3, 0, 1);
  const hology = clamp(GI, 0, 1);
  const dissonance = clamp(1 - GI, 0, 1);

  const R = clamp(
    ((GI * 0.5) + (RC * 0.25) + (meaningScore * 0.25)),
    0,
    1,
  );

  let mode = "chaos";
  if (R >= 0.9) mode = "recursive-consciousness";
  else if (R >= 0.7) mode = "integrated-cognition";
  else if (R >= 0.5) mode = "complex-system";
  else if (R >= 0.2) mode = "simple-order";

  return {
    R, GI, RC, LCS, meaningScore, selfModel, mode,
    telic, hology, dissonance,
  };
}

/** Helper: turn market snapshot into CTR-A events */
export function buildMarketEvents(
  ticker: string,
  closes: number[],
  volumes: number[],
  sentimentItems: { title: string; score: number }[],
  regime: string,
): Event[] {
  const events: Event[] = [];
  const now = Date.now();

  // Price action events
  if (closes.length >= 5) {
    const ret5 = (closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6];
    events.push({
      id: "ret5",
      time: now - 5 * 86400000,
      state: "price",
      meaning: ret5 > 0 ? "uptrend" : "downtrend",
      context: ticker,
      value: ret5,
      prediction: ret5,
    });
  }

  // Volume shock
  if (volumes.length >= 20) {
    const avg = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const last = volumes[volumes.length - 1];
    const ratio = avg ? last / avg : 1;
    events.push({
      id: "volshock",
      time: now,
      state: "volume",
      meaning: ratio > 1.8 ? "high-volume" : "normal-volume",
      context: ticker,
      value: ratio - 1,
    });
  }

  // Sentiment events
  for (let i = 0; i < Math.min(6, sentimentItems.length); i++) {
    const s = sentimentItems[i];
    events.push({
      id: `news-${i}`,
      time: now - i * 3600000,
      state: "news",
      meaning: s.score > 0 ? "positive-news" : s.score < 0 ? "negative-news" : "neutral-news",
      context: ticker,
      value: s.score / 2,
    });
  }

  // Regime event
  events.push({
    id: "regime",
    time: now,
    state: "regime",
    meaning: regime,
    context: ticker,
    value: regime === "trend" ? 0.6 : regime === "meanReversion" ? 0.2 : -0.3,
  });

  return events;
}
