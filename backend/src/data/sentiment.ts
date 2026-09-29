// backend/src/data/sentiment.ts
/**
 * Combined sentiment from Finnhub company news + Reddit (Tradestie).
 * Design: additive, low weight, graceful zeros, { score, magnitude } pattern.
 */

import { fetchFinnhubNews } from "./finnhub.ts";
import { fetchRedditSentiment } from "./reddit.ts";
import { clamp } from "../stats.ts";

export interface SentimentResult {
  score: number; // -1 … +1 combined
  magnitude: number;
  newsScore: number;
  newsMagnitude: number;
  redditScore: number;
  redditMagnitude: number;
}

/** Prefer multi-word / finance-specific phrases to cut false positives */
const POSITIVE = [
  "upgrade",
  "upgraded",
  "beats estimates",
  "beat estimates",
  "beats expectations",
  "beat expectations",
  "strong earnings",
  "record revenue",
  "record profit",
  "raised guidance",
  "raises guidance",
  "price target raised",
  "outperform",
  "overweight",
  "bullish",
  "surge in",
  "rallies on",
];

const NEGATIVE = [
  "downgrade",
  "downgraded",
  "misses estimates",
  "missed estimates",
  "misses expectations",
  "missed expectations",
  "weak earnings",
  "cuts guidance",
  "cut guidance",
  "lowered guidance",
  "price target cut",
  "underperform",
  "underweight",
  "bearish",
  "lawsuit",
  "sec probe",
  "fraud",
  "warning",
  "plunges on",
  "tumbles on",
];

function scoreText(text: string): number {
  const t = text.toLowerCase();
  let s = 0;
  for (const w of POSITIVE) {
    if (t.includes(w)) s += 1;
  }
  for (const w of NEGATIVE) {
    if (t.includes(w)) s -= 1;
  }
  return s;
}

/**
 * Finnhub company-news keyword sentiment (uses existing FINNHUB_API_KEY).
 */
export async function scoreFinnhubNewsSentiment(
  ticker: string,
): Promise<{ score: number; magnitude: number }> {
  try {
    const articles = await fetchFinnhubNews(ticker);
    if (!Array.isArray(articles) || articles.length === 0) {
      return { score: 0, magnitude: 0 };
    }

    const slice = articles.slice(0, 25);
    let raw = 0;
    let hits = 0;
    let n = 0;

    for (const a of slice) {
      const text = `${a.headline ?? ""} ${a.summary ?? ""}`;
      if (!text.trim()) continue;
      n += 1;
      const s = scoreText(text);
      if (s !== 0) {
        raw += s;
        hits += 1;
      }
    }

    if (n === 0) return { score: 0, magnitude: 0 };

    // Soften by article count; require at least some signal
    const score = hits > 0 ? clamp(raw / n / 2, -1, 1) : 0;
    return { score, magnitude: n };
  } catch (err) {
    console.warn("Finnhub news sentiment failed:", err);
    return { score: 0, magnitude: 0 };
  }
}

/**
 * Combined sentiment: 60% news + 40% Reddit when both present.
 * Magnitude is a simple activity proxy used for confidence scaling.
 */
export async function fetchCombinedSentiment(
  ticker: string,
): Promise<SentimentResult> {
  const [news, reddit] = await Promise.all([
    scoreFinnhubNewsSentiment(ticker),
    fetchRedditSentiment(ticker),
  ]);

  const hasNews = news.magnitude > 0 && news.score !== 0;
  const hasReddit = reddit.magnitude > 0;
  // If news has articles but score is 0, still count magnitude for activity
  const hasNewsActivity = news.magnitude > 0;

  let score = 0;
  if (hasNews && hasReddit) {
    score = news.score * 0.6 + reddit.score * 0.4;
  } else if (hasNews) {
    score = news.score;
  } else if (hasReddit) {
    score = reddit.score;
  } else if (hasNewsActivity && hasReddit) {
    score = reddit.score * 0.4;
  }

  const magnitude =
    news.magnitude + Math.min(reddit.magnitude / 20, 15);

  return {
    score: clamp(score, -1, 1),
    magnitude,
    newsScore: news.score,
    newsMagnitude: news.magnitude,
    redditScore: reddit.score,
    redditMagnitude: reddit.magnitude,
  };
}

/**
 * Small additive bias for expectedReturn and a mild confidence multiplier.
 * Keeps Ridge / Ψ / CTR-A dominant (design principle: low weight).
 *
 * maxReturnBias ≈ ±1.5% when score=±1 and magnitude is meaningful
 */
export function applySentimentBias(
  expectedReturn: number,
  confidence: number,
  sentiment: SentimentResult,
): { expectedReturn: number; confidence: number; biasApplied: number } {
  const magFactor = Math.min(1, sentiment.magnitude / 8);
  const bias = clamp(sentiment.score * 0.015 * magFactor, -0.015, 0.015);

  let newReturn = expectedReturn + bias;
  newReturn = clamp(newReturn, -0.15, 0.15);

  let newConf = confidence;
  if (sentiment.magnitude >= 3 && Math.abs(sentiment.score) > 0.05) {
    const confNudge = 1 + 0.06 * magFactor * Math.abs(sentiment.score);
    newConf = clamp(confidence * confNudge, 0, 1);
  }

  return {
    expectedReturn: newReturn,
    confidence: newConf,
    biasApplied: bias,
  };
}
