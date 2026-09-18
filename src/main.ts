import { PORT } from "./config.ts";
import { router } from "./routes.ts";
import { ensureArtifactsLoaded } from "./trainedModels.ts";

async function start() {
  console.log(`Starting Stock Signals API on port ${PORT}...`);

  await ensureArtifactsLoaded();

  const server = Deno.listen({ port: PORT });
  console.log(`Server running at http://localhost:${PORT}`);

  for await (const conn of server) {
    handle(conn);
  }
}

async function handle(conn: Deno.Conn) {
  const httpConn = Deno.serveHttp(conn);

  for await (const evt of httpConn) {
    try {
      const response = await router(evt.request);
      evt.respondWith(response);
    } catch (err) {
      console.error("Request error:", err);
      evt.respondWith(
        new Response(JSON.stringify({ error: "Internal server error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        })
      );
    }
  }
}

start();
