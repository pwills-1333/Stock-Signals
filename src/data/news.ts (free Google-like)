import { GOOGLE_CSE_KEY, GOOGLE_CSE_CX } from "../config.ts";
import { fetchCompanyNews } from "./finnhub.ts";
import { fetchYahooNews } from "./yahoo.ts";

export async function fetchBroadNews(ticker: string, limit = 15) {
  const results: { title: string; summary: string }[] = [];

  // 1. freenewsapi.ai (no key)
  try {
    const url = `https://freenewsapi.ai/v1/search?q=${encodeURIComponent(ticker + " stock OR earnings OR analyst")}&size=${limit}`;
    const res = await fetch(url);
    if (res.ok) {
      const j = await res.json();
      for (const n of j.results || []) {
        results.push({ title: n.title || "", summary: n.description || n.summary || "" });
      }
    }
  } catch { /* ignore */ }

  // 2. Optional Google Custom Search
  if (GOOGLE_CSE_KEY && GOOGLE_CSE_CX && results.length < limit) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_CSE_KEY}&cx=${GOOGLE_CSE_CX}&q=${encodeURIComponent(ticker + " stock news")}&num=10`;
      const res = await fetch(url);
      if (res.ok) {
        const j = await res.json();
        for (const item of j.items || []) {
          results.push({ title: item.title || "", summary: item.snippet || "" });
        }
      }
    } catch { /* ignore */ }
  }

  // 3. Fallbacks
  if (results.length < 5) {
    const fh = await fetchCompanyNews(ticker);
    results.push(...fh);
  }
  if (results.length < 5) {
    const yh = await fetchYahooNews(ticker);
    results.push(...yh);
  }

  return results.slice(0, limit);
}
