console.log("App starting...");
import { PORT } from "./config.ts";
import { handleRequest } from "./routes.ts";
import { loadModelArtifacts } from "./trainedModels.ts";

await loadModelArtifacts();

console.log(`Stock Signal Engine (Ψ + CTR-A) + Mobile UI listening on http://localhost:${PORT}`);

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

  // Serve mobile UI
  if (url.pathname === "/" || url.pathname === "/index.html") {
    try {
      const html = await Deno.readTextFile("./public/index.html");
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch {
      return new Response("UI not found", { status: 404 });
    }
  }

  // All other routes go to the API
  return handleRequest(req);
});
