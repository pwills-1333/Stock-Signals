import { PORT } from "./config.ts";
import { handleRequest } from "./routes.ts";
import { loadModelArtifacts } from "./trainedModels.ts";

await loadModelArtifacts();
console.log(`Stock Signal Engine (Ψ + CTR-A) listening on http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handleRequest);
