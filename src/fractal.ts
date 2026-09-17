import { computeHurst } from "./stats.ts";

export function fractalBlend(expectedReturn: number, closes: number[]) {
  const h = computeHurst(closes);
  // Hurst > 0.55 → trend persistence, amplify; < 0.45 → mean revert, dampen
  const mult = h.value > 0.55 ? 1 + (h.value - 0.5) * 1.4
             : h.value < 0.45 ? 1 - (0.5 - h.value) * 1.2
             : 1;
  return {
    adjustedReturn: expectedReturn * mult,
    hurst: h.value,
    confidence: h.confidence,
  };
}
