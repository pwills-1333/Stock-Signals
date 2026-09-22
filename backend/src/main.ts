// backend/src/main.ts
import { Application, Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { predict } from "./pipeline.ts";
import { screenUniverse } from "./scanner.ts";

const app = new Application();
const router = new Router();

// ---------- Health & Root ----------
router.get("/health", (ctx) => {
  ctx.response.body = { ok: true, service: "Stock-Signals", timestamp: new Date().toISOString() };
});

router.get("/", (ctx) => {
  ctx.response.body = {
    status: "ok",
    service: "Stock-Signals API",
    endpoints: [
      "GET  /health",
      "POST /predict",
      "POST /screen",
    ],
  };
});

// ---------- Predict ----------
router.post("/predict", async (ctx) => {
  try {
    const body = await ctx.request.body.json();
    const ticker = (body.ticker || "").toString().trim();

    if (!ticker) {
      ctx.response.status = 400;
      ctx.response.body = { error: "ticker is required" };
      return;
    }

    const horizonDays = Number(body.horizonDays) || 14;
    const result = await predict({ ticker, horizonDays });
    ctx.response.body = result;
  } catch (err) {
    console.error("Prediction error:", err);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
});

// ---------- Screen universe ----------
router.post("/screen", async (ctx) => {
  try {
    const body = await ctx.request.body.json();
    const universe = Array.isArray(body.universe) ? body.universe : [];
    const limit = Math.min(Number(body.limit) || 10, 50);
    const horizonDays = Number(body.horizonDays) || 14;

    if (universe.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "universe array is required" };
      return;
    }

    const result = await screenUniverse({ universe, limit, horizonDays });
    ctx.response.body = result;
  } catch (err) {
    console.error("Screen error:", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// ---------- Middleware ----------
app.use(
  oakCors({
    origin: "*", // tighten later if needed
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(router.routes());
app.use(router.allowedMethods());

// ---------- Start ----------
const port = Number(Deno.env.get("PORT") ?? 8000);

console.log(`Stock-Signals API starting on http://0.0.0.0:${port}`);
await app.listen({ port, hostname: "0.0.0.0" });
