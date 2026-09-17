import { X_BEARER_TOKEN } from "../config.ts";
import { clamp } from "../stats.ts";

const POS = ["bullish", "buy", "moon", "rocket", "calls", "long", "breakout", "strong"];
const NEG = ["bearish", "sell", "puts", "crash", "dump", "short", "weak", "overvalued"];

export async function fetchXPosts(ticker: string, limit = 20) {
  if (!X_BEARER_TOKEN) return [];

  try {
    const query = encodeURIComponent(`$${ticker} OR ${ticker} stock lang:en -is:retweet`);
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=${Math.min(limit, 100)}&tweet.fields=created_at,public_metrics`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` },
    });
    if (!res.ok) return [];
    const j = await res.json();
    return (j.data || []).map((t: any) => ({
      title: t.text?.slice(0, 120) || "",
      summary: t.text || "",
    }));
  } catch {
    return [];
  }
}

export function scoreXSentiment(posts: { title?: string; summary?: string }[]) {
  let polarity = 0, intensity = 0;
  for (const p of posts || []) {
    const text = ((p.title || "") + " " + (p.summary || "")).toLowerCase();
    let s = 0;
    for (const w of POS) if (text.includes(w)) s += 1;
    for (const w of NEG) if (text.includes(w)) s -= 1;
    s = clamp(s, -2, 2);
    polarity += s;
    intensity += Math.abs(s);
  }
  const len = posts?.length || 0;
  return {
    S: clamp(len ? polarity / (len * 2) : 0, -1, 1),
    E: clamp(len ? intensity / (len * 2) : 0, 0, 1),
    count: len,
  };
}
