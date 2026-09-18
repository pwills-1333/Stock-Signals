export function safeDot(coef: number[], features: number[]): number {
  if (!Array.isArray(coef) || !Array.isArray(features)) return 0;

  let sum = 0;
  const len = Math.min(coef.length, features.length);

  for (let i = 0; i < len; i++) {
    const c = coef[i];
    const f = features[i];
    if (!Number.isFinite(c) || !Number.isFinite(f)) continue;
    sum += c * f;
  }

  return sum;
}

export function ridgePredict(head: any, features: number[]): number {
  if (!head || !Array.isArray(head.coef) || !Number.isFinite(head.intercept)) {
    console.warn("Invalid ridge head:", head);
    return 0;
  }

  const dot = safeDot(head.coef, features);
  const y = head.intercept + dot;

  return Number.isFinite(y) ? y : 0;
}

export function classifySignal(value: number): string {
  if (!Number.isFinite(value)) return "neutral";
  if (value > 0.02) return "buy";
  if (value < -0.02) return "sell";
  return "neutral";
}

export function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.abs(value), 1);
}

export function runAllHeads(heads: any[], features: number[]) {
  if (!Array.isArray(heads)) return [];

  const results = [];

  for (const head of heads) {
    const output = ridgePredict(head, features);
    results.push({
      name: head.name ?? "unnamed",
      output
    });
  }

  return results;
}

export function aggregateHeads(results: any[]) {
  if (!Array.isArray(results) || results.length === 0) {
    return {
      expectedReturn: 0,
      confidence: 0,
      signal: "neutral"
    };
  }

  const avg =
    results.reduce((sum, r) => sum + (r.output ?? 0), 0) / results.length;

  return {
    expectedReturn: avg,
    confidence: normalizeConfidence(avg),
    signal: classifySignal(avg)
  };
}
