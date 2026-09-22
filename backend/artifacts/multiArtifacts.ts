// backend/artifacts/multiArtifacts.ts
import type { ModelArtifact, ModelHead } from "../src/types.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

async function loadJSON(path: string): Promise<any | null> {
  try {
    const raw = await Deno.readTextFile(path);
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to load artifact ${path}:`, err);
    return null;
  }
}

/**
 * Loads every *.json file in the artifacts directory and merges all heads
 * into a single ModelArtifact.
 */
export async function loadAllArtifacts(
  dir = "artifacts",
): Promise<ModelArtifact> {
  const entries: string[] = [];

  try {
    for await (const file of Deno.readDir(dir)) {
      if (file.isFile && file.name.endsWith(".json")) {
        entries.push(join(dir, file.name));
      }
    }
  } catch (err) {
    console.error("Cannot read artifacts directory:", err);
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
    `Loaded ${allHeads.length} heads from ${entries.length} artifact files`,
  );

  return {
    version,
    feature_count: featureCount,
    heads: allHeads,
  };
}
