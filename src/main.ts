import { router } from "./routes.ts";

const PORT = 8000;

Deno.serve(
  {
    port: PORT,
    onListen: () => {
      console.log(`Stock-Signals API running on http://localhost:${PORT}`);
    }
  },
  router
);
