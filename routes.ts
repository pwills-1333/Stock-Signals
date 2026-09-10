import { runAdvancedPipeline } from "./pipeline.ts";
import { runScreener } from "./scanner.ts";
import { optimizeModels } from "./optimizer.ts";
import { listPredictions, updatePrediction, saveAccuracy } from

"./store.ts";
import { fetchYahooOHLC } from "./data/yahoo.ts";

async function json(req: Request) {
try {
return await req.json();
} catch {
return {};
}

}

export async function handleRequest(req: Request): Promise<Response> {
const url = new URL(req.url);
const path = url.pathname;
const headers = {
"content-type": "application/json",
"access-control-allow-origin": "*",
};

if (req.method === "OPTIONS") {
return new Response(null, {
headers: {
...headers,
"access-control-allow-methods": "GET,POST,OPTIONS",
"access-control-allow-headers": "content-type",
},
});
}

try {
if (path === "/health" && req.method === "GET") {
return Response.json({ ok: true, ts: new Date().toISOString() }, {
headers });
}

if (path === "/predict" && req.method === "POST") {
const body = await json(req);
const ticker = String(body.ticker || "").toUpperCase().trim();
if (!ticker) return Response.json({ error: "ticker required" }, {
status: 400, headers });
const horizonDays = Math.min(60, Math.max(1, Number(body.horizonDays)
|| 14));
const result = await runAdvancedPipeline(ticker, horizonDays,
body.settings || {}, {
persist: body.persist !== false,
});
return Response.json(result, { headers });
}

if (path === "/screen" && req.method === "POST") {
const body = await json(req);
const horizonDays = Math.min(30, Math.max(1, Number(body.horizonDays)
|| 14));
const limit = Math.min(20, Math.max(3, Number(body.limit) || 12));
const result = await runScreener(body.universe || [], horizonDays,
limit);
return Response.json(result, { headers });
}

if (path === "/agent/generate" && req.method === "POST") {
const body = await json(req);
const horizonDays = Math.min(30, Math.max(1, Number(body.horizonDays)
|| 14));
const topN = Math.min(5, Math.max(1, Number(body.topN) || 3));
const screen = await runScreener(body.universe || [], horizonDays,
Math.min(40, topN * 8));
const candidates = screen.picks.filter((p) => p.signal !== "AVOID");
const convict = (p: (typeof candidates)[0]) =>
Math.abs(p.expectedReturn || 0) *
(0.5 + 0.5 * (p.confidence || 0)) *
(1 - 0.5 * ((p as { dissonance?: number }).dissonance || 0));
const sorted = [...candidates].sort((a, b) => convict(b) -
convict(a)).slice(0, topN);
const generated = [];
for (const pick of sorted) {
const res = await runAdvancedPipeline(pick.ticker, horizonDays, {
mcPaths: 1500 });
generated.push(res.prediction);
}

return Response.json(
{ horizonDays, generated, screen: screen.picks.slice(0, 12) },
{ headers },
);

}

if (path === "/resolve" && req.method === "POST") {
const pending = (await listPredictions()).filter((p) => !p.resolved);
const now = Date.now();
const due = pending.filter((p) => new Date(p.horizonEndDate).getTime()
<= now);
const items = [];
for (const p of due) {
if (!p.id) continue;
try {
const ohlc = await fetchYahooOHLC(p.ticker, 90);
if (!ohlc.c.length) continue;
const horizonMs = new Date(p.horizonEndDate).getTime();
let idx = ohlc.c.length - 1;
for (let i = 0; i < ohlc.t.length; i++) {
const ts = typeof ohlc.t[i] === "number" ? ohlc.t[i] * 1000 :
Number(ohlc.t[i]);
if (ts >= horizonMs) {
idx = i;
break;
}

}

const actualPrice = ohlc.c[idx];
const errPct = ((actualPrice - p.predictedPrice) / p.predictedPrice) *
100;
const actualReturn = (actualPrice - p.entryPrice) / p.entryPrice;
const hit = Math.sign(p.expectedReturn) === Math.sign(actualReturn);
await updatePrediction(p.id, { resolved: true, actualPrice, errorPct:
errPct });
await saveAccuracy({
ticker: p.ticker,
predictionId: p.id,
horizonDays: p.horizonDays,
entryPrice: p.entryPrice,
predictedPrice: p.predictedPrice,
expectedReturn: p.expectedReturn,
confidence: p.confidence,
signal: p.signal,
tradeGrade: p.tradeGrade,
signalQuality: p.signalQuality,
regime: p.regime,
actualPrice,
errorPct: errPct,
hit,
createdAt: new Date().toISOString(),
});
items.push({ id: p.id, ticker: p.ticker, errPct, hit });
} catch {
/* skip */
}

}

return Response.json({ resolved: items.length, items }, { headers });
}

if (path === "/optimize/weights" && req.method === "POST") {
return Response.json(await optimizeModels(), { headers });
}

return Response.json({ error: "not found" }, { status: 404, headers
});
} catch (e) {
return Response.json(
{ error: String((e as Error).message || e) },
{ status: 500, headers },
);

}

}
