console.log("App starting...");

import { PORT, ARTIFACTS_PATH } from "./config.ts";
import { handleRequest } from "./routes.ts";
import { loadModelArtifacts } from "./trainedModels.ts";

try {
  await loadModelArtifacts();
  console.log(`Loaded model artifacts from ${ARTIFACTS_PATH}`);
} catch (err) {
  console.error("Failed to load model artifacts:", err);
  // Fail fast — but with a clear log
  Deno.exit(1);
}

console.log(`Stock Signal Engine (Ψ + CTR-A) listening on port ${PORT}`);

Deno.serve({ port: PORT }, async (req) => {
  try {
    return await handleRequest(req);
  } catch (err) {
    console.error("API error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
});
