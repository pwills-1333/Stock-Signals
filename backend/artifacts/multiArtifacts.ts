// backend/artifacts/multiArtifacts.ts
import type { ModelArtifact, ModelHead } from "../src/types.ts";
import { join, dirname, fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";

async function loadJSON(path: string): Promise<any | null> {
  try {
    const raw = await Deno.readTextFile(path);
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to load artifact ${path}:`, err);
    return null;
  }
}

function resolveArtifactsDir(dir: string): string {
  // Absolute path wins
  if (dir.startsWith("/") || /^[A-Za-z]:[\\/]/.test(dir)) {
    return dir;
  }

  // Prefer directory next to this file (works in Docker: /app/artifacts)
  try {
    const here = dirname(fromFileUrl(import.meta.url));
    return join(here, dir === "artifacts" ? "." : dir);
  } catch {
    // Fallback: cwd-relative
    return dir;
  }
}

/**
 * Loads every *.json file in the artifacts directory and merges all heads
 * into a single ModelArtifact.
 */
export async function loadAllArtifacts(
  dir = "artifacts",
): Promise<ModelArtifact> {
  const resolved = resolveArtifactsDir(dir);
  const entries: string[] = [];

  console.log(`Loading artifacts from: ${resolved} (cwd=${Deno.cwd()})`);

  try {
    for await (const file of Deno.readDir(resolved)) {
      if (file.isFile && file.name.endsWith(".json")) {
        entries.push(join(resolved, file.name));
      }
    }
  } catch (err) {
    console.error("Cannot read artifacts directory:", resolved, err);
    return {
      version: "empty",
      feature_count: 0,
      heads: [],
    };
  }

  const allHeads: ModelHead[] = [];
  let featureCount = 0;
  let version = "multi-artifact";

  for (const filePath of entries) {
    const data = await loadJSON(filePath);
    if (!data || !Array.isArray(data.heads)) continue;

    if (featureCount === 0 && typeof data.feature_count === "number") {
      featureCount = data.feature_count;
    }
    if (data.version) {
      version = String(data.version);
    }

    for (const head of data.heads) {
      if (!head) continue;
      allHeads.push({
        name: head.name ?? "unnamed",
        coef: Array.isArray(head.coef) ? head.coef.map(Number) : [],
        intercept: Number.isFinite(head.intercept) ? Number(head.intercept) : 0,
      });
    }
  }

  console.log(
    `Loaded ${allHeads.length} heads from ${entries.length} artifact files in ${resolved}`,
  );

  return {
    version,
    feature_count: featureCount,
    heads: allHeads,
  };
}
