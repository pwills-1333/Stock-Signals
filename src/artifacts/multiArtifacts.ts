import { ModelArtifact, ModelHead } from "../types.ts";
import { join } from "https://deno.land/std/path/mod.ts";

async function loadJSON(path: string): Promise<any | null> {
  try {
    const raw = await Deno.readTextFile(path);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadAllArtifacts(dir = "src/artifacts"): Promise<ModelArtifact> {
  const entries: string[] = [];

  for await (const file of Deno.readDir(dir)) {
    if (file.isFile && file.name.endsWith(".json")) {
      entries.push(join(dir, file.name));
    }
  }

  const allHeads: ModelHead[] = [];
  let featureCount = 0;

  for (const filePath of entries) {
    const data = await loadJSON(filePath);
    if (!data || !Array.isArray(data.heads)) continue;

    if (featureCount === 0 && typeof data.feature_count === "number") {
      featureCount = data.feature_count;
    }

    for (const head of data.heads) {
      allHeads.push({
        name: head.name ?? "unnamed",
        coef: Array.isArray(head.coef) ? head.coef : [],
        intercept: Number.isFinite(head.intercept) ? head.intercept : 0
      });
    }
  }

  return {
    version: "multi-artifact",
    feature_count: featureCount,
    heads: allHeads
  };
}
