export interface RidgeHead {
  name: string;
  coef: number[];
  intercept: number;
}

export interface ModelArtifact {
  version: string;
  feature_count: number;
  heads: RidgeHead[];
}

export function runRidgeHead(head: RidgeHead, features: number[]): number {
  if (!head || !Array.isArray(head.coef) || !Number.isFinite(head.intercept)) {
    return 0;
  }

  let y = head.intercept;

  const len = Math.min(head.coef.length, features.length);
  for (let i = 0; i < len; i++) {
    const c = head.coef[i];
    const f = features[i];
    if (Number.isFinite(c) && Number.isFinite(f)) {
      y += c * f;
    }
  }

  return Number.isFinite(y) ? y : 0;
}

export function runAllHeads(artifact: ModelArtifact, features: number[]) {
  if (!artifact || !Array.isArray(artifact.heads)) return [];

  const outputs = [];

  for (const head of artifact.heads) {
    const out = runRidgeHead(head, features);
    outputs.push({
      name: head.name,
      output: out
    });
  }

  return outputs;
}

export function aggregateHeadOutputs(outputs: { name: string; output: number }[]) {
  if (!Array.isArray(outputs) || outputs.length === 0) {
    return {
      expectedReturn: 0,
      confidence: 0,
      signal: "neutral"
    };
  }

  const avg =
    outputs.reduce((sum, r) => sum + (r.output ?? 0), 0) / outputs.length;

  const confidence = Math.min(Math.abs(avg), 1);

  let signal = "neutral";
  if (avg > 0.02) signal = "buy";
  if (avg < -0.02) signal = "sell";

  return {
    expectedReturn: avg,
    confidence,
    signal
  };
}
