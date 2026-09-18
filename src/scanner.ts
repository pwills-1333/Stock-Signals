import { Prediction } from "./types.ts";
import { predict } from "./pipeline.ts";

export interface ScreenInput {
  universe: string[];
  limit: number;
  horizonDays: number;
}

export interface ScreenResult {
  ticker: string;
  score: number;
  expectedReturn: number;
  confidence: number;
  signal: string;
}

export async function screenUniverse(input: ScreenInput): Promise<ScreenResult[]> {
  const { universe, limit, horizonDays } = input;

  const results: ScreenResult[] = [];

  for (const ticker of universe) {
    try {
      const p: Prediction = await predict({ ticker, horizonDays });

      const score = Number.isFinite(p.expectedReturn) && Number.isFinite(p.confidence)
        ? p.expectedReturn * p.confidence
        : 0;

      results.push({
        ticker,
        score,
        expectedReturn: p.expectedReturn ?? 0,
        confidence: p.confidence ?? 0,
        signal: p.signal ?? "neutral"
      });
    } catch {
      results.push({
        ticker,
        score: 0,
        expectedReturn: 0,
        confidence: 0,
        signal: "neutral"
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}
