import { predict } from "./pipeline.ts";
import { screenUniverse } from "./scanner.ts";
import { savePrediction, resolvePrediction, resolveAll } from "./store.ts";
import { optimizeWeights } from "./optimizer.ts";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function router(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Healthcheck
    if (method === "GET" && path === "/health") {
      return json({ status: "ok" });
    }

    // Predict
    if (method === "POST" && path === "/predict") {
      const body = await request.json();
      const result = await predict(body);
      return json(result);
    }

    // Screen universe
    if (method === "POST" && path === "/screen") {
      const body = await request.json();
      const result = await screenUniverse(body);
      return json(result);
    }

    // Save prediction
    if (method === "POST" && path === "/agent/generate") {
      const body = await request.json();
      const stored = savePrediction(body);
      return json(stored);
    }

    // Resolve single prediction
    if (method === "POST" && path === "/resolve") {
      const body = await request.json();
      const { id, actualPrice } = body;
      const result = resolvePrediction(id, actualPrice);
      return json(result);
    }

    // Resolve all predictions (accuracy summary)
    if (method === "GET" && path === "/resolve/all") {
      const result = resolveAll();
      return json(result);
    }

    // Optimize weights
    if (method === "POST" && path === "/optimize/weights") {
      const result = await optimizeWeights();
      return json(result);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Route error:", err);
    return json({ error: "Internal server error" }, 500);
  }
}
