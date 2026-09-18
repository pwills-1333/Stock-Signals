// src/routes.ts
// Clean, correct API server for Stock-Signals

import { predict } from "./pipeline.ts";

export async function handleRequest(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === "/") {
      return new Response(
        JSON.stringify({ status: "ok", service: "Stock-Signals API" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prediction endpoint: /predict?ticker=AAPL&horizon=5
    if (url.pathname === "/predict") {
      const ticker = url.searchParams.get("ticker") ?? "";
      const horizon = Number(url.searchParams.get("horizon") ?? "5");

      if (!ticker) {
        return new Response(
          JSON.stringify({ error: "Missing ticker parameter" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const result = await predict({
        ticker,
        horizonDays: horizon
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Unknown route
    return new Response(
      JSON.stringify({ error: "Route not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("API error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Deno server bootstrap
export default {
  port: 8000,
  fetch: handleRequest
};
