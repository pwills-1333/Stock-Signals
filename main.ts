import { PORT } from "./config.ts";
import { handleRequest } from "./routes.ts";
import { loadModelArtifacts } from "./trainedModels.ts";

await loadModelArtifacts();
console.log(`Stock Signal Engine listening on
http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handleRequest);
