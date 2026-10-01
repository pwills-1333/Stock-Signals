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
  resolveDuePredictions,
} from "./store.ts";
import { loadLearningState } from "./learning/state.ts";
import { fetchOHLC } from "./data.ts";
import {
  RESOLVE_SECRET,
  RESOLVE_DUE_INTERVAL_MS,
  RESOLVE_DUE_LIMIT,
  DATA_DIR,
} from "./config.ts";
import {
  RESOLVE_SECRET,
  RESOLVE_DUE_INTERVAL_MS,
  RESOLVE_DUE_LIMIT,
  DATA_DIR,
  PROTECT_LEARNING_STATE,
} from "./config.ts";

const app = new Application();
const router = new Router();

const RESOLVE_EARLY_SLACK_MS = 6 * 60 * 60 * 1000; // 6 hours

function getClientIp(ctx: {
  request: { headers: Headers; ip: string };
}): string {
  const forwarded = ctx.request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return ctx.request.ip || "unknown";
}

/** Optional shared secret for mutate-learning endpoints */
function checkResolveAuth(ctx: {
  request: { headers: Headers };
  response: { status: number; body: unknown };
}): boolean {
  if (!RESOLVE_SECRET) return true;
  const got = ctx.request.headers.get("x-resolve-secret") || "";
  if (got === RESOLVE_SECRET) return true;
  ctx.response.status = 401;
  ctx.response.body = {
    error: "unauthorized",
    message: "Missing or invalid X-Resolve-Secret header",
  };
  return false;
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
      "POST /resolve-due",
      "GET /learning/state",
      "GET /accuracy",
    ],
    resolveAuthRequired: Boolean(RESOLVE_SECRET),
    autoResolveDueMs: RESOLVE_DUE_INTERVAL_MS || null,
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
 * Headers: X-Resolve-Secret (if RESOLVE_SECRET set)
 * body: { id, actualPrice?, force? }
 */
router.post("/resolve", async (ctx) => {
  const ip = getClientIp(ctx);
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    ctx.response.status = 429;
    ctx.response.body = { error: "Too many requests" };
    return;
  }
  if (!checkResolveAuth(ctx)) return;

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

    const force = Boolean(body.force);
    const existing = await getPrediction(id);
    if (!existing) {
      ctx.response.status = 404;
      ctx.response.body = { error: "prediction not found" };
      return;
    }

    if (existing.resolved) {
      ctx.response.status = 409;
      ctx.response.body = { error: "prediction already resolved", id };
      return;
    }

    const horizonMs = Date.parse(existing.horizonEndDate || "");
    if (
      !force &&
      Number.isFinite(horizonMs) &&
      Date.now() + RESOLVE_EARLY_SLACK_MS < horizonMs
    ) {
      ctx.response.status = 425;
      ctx.response.body = {
        error: "horizon not reached",
        message:
          "Wait until horizonEndDate, or pass force:true to resolve early (testing only). actualPrice alone does not skip the horizon check.",
        horizonEndDate: existing.horizonEndDate,
        id,
      };
      return;
    }

    let actualPrice = Number(body.actualPrice);
    const hasExplicitPrice = Number.isFinite(actualPrice) && actualPrice > 0;

    if (!hasExplicitPrice) {
      const ohlc = await fetchOHLC(existing.ticker);
      actualPrice = ohlc?.c?.length ? ohlc.c[ohlc.c.length - 1] : 0;
    }

    if (!(actualPrice > 0)) {
      ctx.response.status = 422;
      ctx.response.body = { error: "Could not determine actualPrice" };
      return;
    }

    const rec = await resolvePrediction(id, actualPrice);
    ctx.response.body = {
      ok: true,
      record: rec,
      learning: await loadLearningState(),
      usedExplicitPrice: hasExplicitPrice,
      forced: force,
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

/**
 * POST /resolve-due
 * Headers: X-Resolve-Secret (if RESOLVE_SECRET set)
 * body: { limit?: number }
 */
router.post("/resolve-due", async (ctx) => {
  const ip = getClientIp(ctx);
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    ctx.response.status = 429;
    ctx.response.body = { error: "Too many requests" };
    return;
  }
  if (!checkResolveAuth(ctx)) return;

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await ctx.request.body.json();
    } catch {
      body = {};
    }

    const n = Number(body.limit) || RESOLVE_DUE_LIMIT;
    const result = await resolveDuePredictions({
      limit: n,
      slackMs: RESOLVE_EARLY_SLACK_MS,
    });

    ctx.response.body = {
      ok: true,
      ...result,
      learning: await loadLearningState(),
    };
  } catch (err) {
    console.error("Resolve-due error:", err);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
});

router.get("/learning/state", async (ctx) => {
  // Optional: require same secret as resolve when PROTECT_LEARNING_STATE=true
  if (PROTECT_LEARNING_STATE && !checkResolveAuth(ctx)) return;

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
    allowedHeaders: ["Content-Type", "X-Resolve-Secret"],
    optionsSuccessStatus: 200,
  }),
);

app.use(router.routes());
app.use(router.allowedMethods());

/** In-process scheduler for learning feedback (optional) */
function startResolveDueScheduler(): void {
  if (!(RESOLVE_DUE_INTERVAL_MS > 0)) {
    console.log(
      "Auto resolve-due disabled (set RESOLVE_DUE_INTERVAL_MS e.g. 86400000 for daily).",
    );
    return;
  }

  const run = async () => {
    try {
      const result = await resolveDuePredictions({
        limit: RESOLVE_DUE_LIMIT,
        slackMs: RESOLVE_EARLY_SLACK_MS,
      });
      if (result.attempted > 0) {
        console.log(
          `resolve-due: attempted=${result.attempted} resolved=${result.resolved} failed=${result.failed.length}`,
        );
      }
    } catch (err) {
      console.warn("resolve-due scheduler error:", err);
    }
  };

  // First run after 60s (let server warm up), then on interval
  setTimeout(() => {
    run();
    setInterval(run, RESOLVE_DUE_INTERVAL_MS);
  }, 60_000);

  console.log(
    `Auto resolve-due every ${RESOLVE_DUE_INTERVAL_MS}ms (limit ${RESOLVE_DUE_LIMIT}).`,
  );
}

try {
  await Deno.mkdir(DATA_DIR, { recursive: true });
} catch {
  // ok
}

const port = Number(Deno.env.get("PORT") ?? 8000);
console.log(`Stock-Signals API starting on http://0.0.0.0:${port}`);
console.log(
  `DATA_DIR=${DATA_DIR} — mount a persistent volume in production or learning state is lost on redeploy.`,
);
if (RESOLVE_SECRET) {
  console.log("Resolve endpoints require X-Resolve-Secret header.");
}
startResolveDueScheduler();
await app.listen({ port, hostname: "0.0.0.0" });
