// backend/src/main.ts
import { Application, Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { predict } from "./pipeline.ts";
import { screenUniverse } from "./scanner.ts";
import { checkRateLimit } from "./rateLimit.ts";
import {
  savePrediction,
  resolvePrediction,
  getPrediction,
  listAccuracy,
  resolveAllStats,
} from "./store.ts";
import { loadLearningState } from "./learning/state.ts";
import { fetchOHLC } from "./data.ts";

const app = new Application();
const router = new Router();

function getClientIp(ctx: {
  request: { headers: Headers; ip: string };
}): string {
  const forwarded = ctx.request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return ctx.request.ip || "unknown";
}

router.get("/health", (ctx) => {
  ctx.response.body = {
    ok: true,
    service: "Stock-Signals",
    timestamp: new Date().toISOString(),
  };
});

router.get("/", (ctx) => {
  ctx.response.body = {
    status: "ok",
    service: "Stock-Signals API",
    endpoints: [
      "GET /health",
      "POST /predict",
      "POST /screen",
      "POST /resolve",
      "GET /learning/state",
      "GET /accuracy",
    ],
  };
});

router.post("/predict", async (ctx) => {
  const ip = getClientIp(ctx);
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    ctx.response.status = 429;
    ctx.response.headers.set("Retry-After", String(limit.retryAfterSec ?? 60));
    ctx.response.body = {
      error: "Too many requests",
      message: `Rate limit exceeded. Retry in ${limit.retryAfterSec ?? 60}s`,
    };
    return;
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await ctx.request.body.json();
    } catch {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Invalid JSON body",
        message: "Request body must be valid JSON",
      };
      return;
    }

    const ticker = String(body.ticker ?? "").trim();
    if (!ticker) {
      ctx.response.status = 400;
      ctx.response.body = { error: "ticker is required" };
      return;
    }

    const horizonDays = Number(body.horizonDays) || 14;
    const result = await predict({ ticker, horizonDays });

    if (!result.entryPrice || result.entryPrice === 0) {
      ctx.response.status = 422;
      ctx.response.body = {
        error: result.rationale || "No usable market data for this ticker",
        ...result,
      };
      return;
    }

    // Persist for later resolve + learning
    const stored = await savePrediction(result);
    ctx.response.body = stored;
  } catch (err) {
    console.error("Prediction error:", err);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
});

/**
 * POST /resolve
 * body: { id: string, actualPrice?: number }
 * If actualPrice omitted, fetches latest close for the prediction ticker.
 */
router.post("/resolve", async (ctx) => {
  const ip = getClientIp(ctx);
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    ctx.response.status = 429;
    ctx.response.body = { error: "Too many requests" };
    return;
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await ctx.request.body.json();
    } catch {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid JSON body" };
      return;
    }

    const id = String(body.id ?? "").trim();
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { error: "id is required" };
      return;
    }

    const existing = await getPrediction(id);
    if (!existing) {
      ctx.response.status = 404;
      ctx.response.body = { error: "prediction not found" };
      return;
    }

    let actualPrice = Number(body.actualPrice);
    if (!(actualPrice > 0)) {
      const ohlc = await fetchOHLC(existing.ticker);
      actualPrice = ohlc?.c?.length
        ? ohlc.c[ohlc.c.length - 1]
        : 0;
    }

    if (!(actualPrice > 0)) {
      ctx.response.status = 422;
      ctx.response.body = {
        error: "Could not determine actualPrice",
      };
      return;
    }

    const rec = await resolvePrediction(id, actualPrice);
    ctx.response.body = {
      ok: true,
      record: rec,
      learning: await loadLearningState(),
    };
  } catch (err) {
    console.error("Resolve error:", err);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
});

router.get("/learning/state", async (ctx) => {
  try {
    ctx.response.body = await loadLearningState();
  } catch (err) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

router.get("/accuracy", async (ctx) => {
  try {
    const stats = await resolveAllStats();
    const records = await listAccuracy();
    ctx.response.body = { stats, records: records.slice(-100) };
  } catch (err) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

router.post("/screen", async (ctx) => {
  const ip = getClientIp(ctx);
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    ctx.response.status = 429;
    ctx.response.headers.set("Retry-After", String(limit.retryAfterSec ?? 60));
    ctx.response.body = {
      error: "Too many requests",
      message: `Rate limit exceeded. Retry in ${limit.retryAfterSec ?? 60}s`,
    };
    return;
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await ctx.request.body.json();
    } catch {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Invalid JSON body",
        message: "Request body must be valid JSON",
      };
      return;
    }

    const universe = Array.isArray(body.universe) ? body.universe : [];
    const limitN = Math.min(Number(body.limit) || 10, 50);
    const horizonDays = Number(body.horizonDays) || 14;

    if (universe.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "universe array is required" };
      return;
    }

    const capped = universe.slice(0, 30);

    ctx.response.body = await screenUniverse({
      universe: capped,
      limit: limitN,
      horizonDays,
    });
  } catch (err) {
    console.error("Screen error:", err);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
});

app.use(
  oakCors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    optionsSuccessStatus: 200,
  }),
);

app.use(router.routes());
app.use(router.allowedMethods());

const port = Number(Deno.env.get("PORT") ?? 8000);
console.log(`Stock-Signals API starting on http://0.0.0.0:${port}`);
await app.listen({ port, hostname: "0.0.0.0" });
