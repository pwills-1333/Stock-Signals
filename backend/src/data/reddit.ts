// backend/src/data/reddit.ts
/**
 * Reddit / WSB sentiment via Tradestie free API.
 * Returns { score, magnitude } matching the existing news/X pattern.
 * Graceful: returns zeros on any failure (no key required).
 */

export interface SentimentResult {
  score: number; // -1 … +1
  magnitude: number; // ~0 … N (comment volume proxy)
  source: string;
}

interface TradestieRow {
  ticker?: string;
  sentiment?: string;
  sentiment_score?: number;
  no_of_comments?: number;
}

const TRADESTIE_URL = "https://tradestie.com/api/v1/apps/reddit";

// Short in-memory cache of the top list (shared across tickers)
let listCache: { rows: TradestieRow[]; expires: number } | null = null;
const LIST_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchTradestieList(): Promise<TradestieRow[]> {
  const now = Date.now();
  if (listCache && now < listCache.expires) {
    return listCache.rows;
  }

  try {
    const res = await fetch(TRADESTIE_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Stock-Signals/1.0 (pwills-1333)",
      },
    });

    if (!res.ok) {
      console.warn("Tradestie HTTP", res.status);
      return listCache?.rows ?? [];
    }

    const data = await res.json();
    const rows: TradestieRow[] = Array.isArray(data) ? data : [];
    listCache = { rows, expires: now + LIST_TTL_MS };
    return rows;
  } catch (err) {
    console.warn("Tradestie fetch failed:", err);
    return listCache?.rows ?? [];
  }
}

/**
 * Look up ticker in the current WSB top list.
 * score = sentiment_score (already roughly -1…+1-ish from API)
 * magnitude = comment count (capped for stability)
 */
export async function fetchRedditSentiment(
  ticker: string,
): Promise<SentimentResult> {
  const symbol = ticker.toUpperCase().trim();
  if (!symbol) {
    return { score: 0, magnitude: 0, source: "reddit" };
  }

  const rows = await fetchTradestieList();
  const row = rows.find(
    (r) => (r.ticker || "").toUpperCase() === symbol,
  );

  if (!row) {
    return { score: 0, magnitude: 0, source: "reddit" };
  }

  let score = Number(row.sentiment_score);
  if (!Number.isFinite(score)) {
    const label = (row.sentiment || "").toLowerCase();
    if (label.includes("bull")) score = 0.25;
    else if (label.includes("bear")) score = -0.25;
    else score = 0;
  }

  // Clamp to [-1, 1]
  score = Math.max(-1, Math.min(1, score));

  const comments = Number(row.no_of_comments);
  const magnitude = Number.isFinite(comments) && comments > 0
    ? Math.min(comments, 500)
    : 0;

  return {
    score,
    magnitude,
    source: "reddit",
  };
}
