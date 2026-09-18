const BASE = "https://api.x.com/2/tweets/search/recent";

async function fetchJSON(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchXPosts(ticker: string): Promise<any[]> {
  const query = encodeURIComponent(`$${ticker} OR ${ticker}`);
  const url = `${BASE}?query=${query}&max_results=20`;

  const data = await fetchJSON(url);
  if (!data || !Array.isArray(data.data)) return [];

  return data.data.map((post: any) => ({
    id: post.id ?? "",
    text: post.text ?? "",
    createdAt: post.created_at ?? "",
    authorId: post.author_id ?? ""
  }));
}

export async function fetchXSentiment(ticker: string): Promise<{
  score: number;
  magnitude: number;
}> {
  const posts = await fetchXPosts(ticker);
  if (posts.length === 0) {
    return { score: 0, magnitude: 0 };
  }

  let score = 0;
  let magnitude = 0;

  for (const p of posts) {
    const t = (p.text || "").toLowerCase();

    if (t.includes("bullish") || t.includes("buy")) score += 1;
    if (t.includes("bearish") || t.includes("sell")) score -= 1;

    magnitude += 1;
  }

  const finalScore = magnitude > 0 ? score / magnitude : 0;

  return {
    score: finalScore,
    magnitude
  };
}
