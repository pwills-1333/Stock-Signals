// backend/src/rateLimit.ts
// Simple in-memory rate limiter (per IP)

const hits = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;  // per window per IP

export function checkRateLimit(ip: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { ok: false, retryAfterSec };
  }

  entry.count += 1;
  return { ok: true };
}

// Optional: periodic cleanup to avoid unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now > entry.resetAt) hits.delete(ip);
  }
}, 5 * 60_000);
