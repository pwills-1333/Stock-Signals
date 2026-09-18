console.log("App starting...");

import { PORT, ARTIFACTS_PATH } from "./config.ts";
import { handleRequest } from "./routes.ts";
import { loadModelArtifacts } from "./trainedModels.ts";

await loadModelArtifacts();
console.log(`Loaded model artifacts from ${ARTIFACTS_PATH}`);

console.log(`Stock Signal Engine (Ψ + CTR-A) listening on port ${PORT}`);

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

  // If you keep UI here (for local dev only):
  if (url.pathname === "/" || url.pathname === "/index.html") {
    try {
      const html = await Deno.readTextFile("./public/index.html");
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch (err) {
      console.error("Failed to load UI:", err);
      return new Response("UI not found", { status: 404 });
    }
  }

  // API routes
  return handleRequest(req);
});
