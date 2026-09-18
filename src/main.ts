console.log("App starting...");
import { PORT } from "./config.ts";
import { handleRequest } from "./routes.ts";
import { loadModelArtifacts } from "./trainedModels.ts";

await loadModelArtifacts();

const port = Number(Deno.env.get("PORT") ?? PORT);
console.log(`Stock Signal Engine (Ψ + CTR-A) listening on port ${port}`);

Deno.serve({ port }, async (req) => {
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
