const BASE = "https://newsapi.org/v2/everything";

async function fetchJSON(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchNews(ticker: string): Promise<any[]> {
  const apiKey = Deno.env.get("NEWS_API_KEY");
  if (!apiKey) return [];

  const query = encodeURIComponent(`${ticker} stock OR ${ticker} shares`);
  const url = `${BASE}?q=${query}&sortBy=publishedAt&language=en&apiKey=${apiKey}`;

  const data = await fetchJSON(url);
  if (!data || !Array.isArray(data.articles)) return [];

  return data.articles.map((a: any) => ({
    title: a.title ?? "",
    description: a.description ?? "",
    url: a.url ?? "",
    publishedAt: a.publishedAt ?? "",
    source: a.source?.name ?? ""
  }));
}

export async function scoreNewsSentiment(ticker: string): Promise<{
  score: number;
  magnitude: number;
}> {
  const articles = await fetchNews(ticker);
  if (articles.length === 0) {
    return { score: 0, magnitude: 0 };
  }

  let score = 0;
  let magnitude = 0;

  for (const a of articles) {
    const t = `${a.title} ${a.description}`.toLowerCase();

    if (t.includes("upgrade") || t.includes("beats") || t.includes("strong"))
      score += 1;

    if (t.includes("downgrade") || t.includes("misses") || t.includes("weak"))
      score -= 1;

    magnitude += 1;
  }

  const finalScore = magnitude > 0 ? score / magnitude : 0;

  return {
    score: finalScore,
    magnitude
  };
}
