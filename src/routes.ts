import { predict } from "./pipeline.ts";
import { screenUniverse } from "./scanner.ts";
import { generateAgentIdeas } from "./agent.ts";
import { resolveOutcomes } from "./store.ts";
import { optimizeWeights } from "./optimizer.ts";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function cors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "OPTIONS") {
    return cors();
  }

  try {
    if (method === "GET" && path === "/health") {
      return json({ status: "ok" });
    }

    if (method === "POST" && path === "/predict") {
      const body = await request.json().catch(() => null);
      if (!body || !body.ticker) {
        return json({ error: "Missing ticker in request body" }, 400);
      }
      console.log("Predict request:", body);
      const result = await predict(body);
      return json(result);
    }

    if (method === "POST" && path === "/screen") {
      const body = await request.json().catch(() => null);
      if (!body || !Array.isArray(body.tickers)) {
        return json({ error: "Missing tickers array" }, 400);
      }
      console.log("Screen request:", body);
      const result = await screenUniverse(body);
      return json(result);
    }

    if (method === "POST" && path === "/agent/generate") {
      const body = await request.json().catch(() => null);
      console.log("Agent generate request:", body);
      const result = await generateAgentIdeas(body);
      return json(result);
    }

    if (method === "POST" && path === "/resolve") {
      console.log("Resolve outcomes");
      const result = await resolveOutcomes();
      return json(result);
    }

    if (method === "POST" && path === "/optimize/weights") {
      console.log("Optimize weights");
      const result = await optimizeWeights();
      return json(result);
    }

    return json({ error: "Not found" }, 404);

  } catch (err) {
    console.error("Route error:", err);
    return json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err)
      },
      500
    );
  }
}
