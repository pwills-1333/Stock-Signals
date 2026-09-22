// backend/src/scanner.ts
import type { Prediction } from "./types.ts";
import { predict } from "./pipeline.ts";

export interface ScreenInput {
  universe: string[];
  limit?: number;
  horizonDays?: number;
}

export interface ScreenResult {
  ticker: string;
  score: number;
  expectedReturn: number;
  confidence: number;
  signal: string;
  regime: string;
}

export async function screenUniverse(
  input: ScreenInput,
): Promise<ScreenResult[]> {
  const universe = (input.universe || [])
    .map((t) => t.toUpperCase().trim())
    .filter(Boolean);

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const horizonDays = input.horizonDays ?? 14;

  const results: ScreenResult[] = [];

  // Process sequentially to be gentle on free API tiers
  for (const ticker of universe) {
    try {
      const p: Prediction = await predict({ ticker, horizonDays });

      const score =
        Number.isFinite(p.expectedReturn) && Number.isFinite(p.confidence)
          ? p.expectedReturn * p.confidence
          : 0;

      results.push({
        ticker,
        score,
        expectedReturn: p.expectedReturn ?? 0,
        confidence: p.confidence ?? 0,
        signal: p.signal ?? "neutral",
        regime: p.regime ?? "neutral",
      });
    } catch (err) {
      console.warn(`Screen failed for ${ticker}:`, err);
      results.push({
        ticker,
        score: 0,
        expectedReturn: 0,
        confidence: 0,
        signal: "neutral",
        regime: "neutral",
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
