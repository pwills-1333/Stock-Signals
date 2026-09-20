import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

import { predict } from "./pipeline.ts";

const app = new Application();
const router = new Router();

router.get("/health", (ctx) => {
  ctx.response.body = { ok: true };
});

router.post("/predict", async (ctx) => {
  try {
    const body = await ctx.request.body.json();
    const { ticker, horizonDays } = body;

    if (!ticker) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Ticker is required" };
      return;
    }

    const result = await predict({ ticker, horizonDays: horizonDays ?? 14 });
    ctx.response.body = result;

  } catch (err) {
    console.error("Prediction error:", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

app.use(
  oakCors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(router.routes());
app.use(router.allowedMethods());

const port = Number(Deno.env.get("PORT") ?? 8000);
console.log(`Stock-Signals API running on http://0.0.0.0:${port}`);

await app.listen({ port });
