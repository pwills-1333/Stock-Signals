// backend/src/main.ts
import { Application, Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { predict } from "./pipeline.ts";
import { screenUniverse } from "./scanner.ts";
import { checkRateLimit } from "./rateLimit.ts";

const app = new Application();
const router = new Router();

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  // "https://your-frontend.up.railway.app",
];

function getClientIp(ctx: { request: { headers: Headers; ip: string } }): string {
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
    endpoints: ["GET /health", "POST /predict", "POST /screen"],
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
    const body = await ctx.request.body.json();
    const ticker = (body.ticker || "").toString().trim();

    if (!ticker) {
      ctx.response.status = 400;
      ctx.response.body = { error: "ticker is required" };
      return;
    }

    const horizonDays = Number(body.horizonDays) || 14;
    ctx.response.body = await predict({ ticker, horizonDays });
  } catch (err) {
    console.error("Prediction error:", err);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
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
    const body = await ctx.request.body.json();
    const universe = Array.isArray(body.universe) ? body.universe : [];
    const limitN = Math.min(Number(body.limit) || 10, 50);
    const horizonDays = Number(body.horizonDays) || 14;

    if (universe.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "universe array is required" };
      return;
    }

    ctx.response.body = await screenUniverse({
      universe,
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
    origin: (ctx) => {
      const origin = ctx.request.headers.get("Origin") || "";
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      return origin || "*";
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(router.routes());
app.use(router.allowedMethods());

const port = Number(Deno.env.get("PORT") ?? 8000);
console.log(`Stock-Signals API starting on http://0.0.0.0:${port}`);
await app.listen({ port, hostname: "0.0.0.0" });
