import { router } from "./routes.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8000);

Deno.serve(
  {
    port: PORT,
    hostname: "0.0.0.0",
    onListen: () => {
      console.log(`Stock-Signals API running on http://0.0.0.0:${PORT}`);
    }
  },
  router
);
