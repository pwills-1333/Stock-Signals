// backend/artifacts/multiArtifacts.ts
import type { ModelArtifact } from "../src/types.ts";

/**
 * Loads and merges all head JSON files in the artifacts folder.
 * Returns a single ModelArtifact that the pipeline can use.
 */
export async function loadAllArtifacts(
  _dir = "artifacts",
): Promise<ModelArtifact | null> {
  const files = [
    "heads_v1.json",
    "heads_v2.json",
    "heads_v3.json",
    "heads_v4.json",
  ];

  const allHeads: ModelArtifact["heads"] = [];
  let version = "merged";
  let featureCount = 20;

  for (const file of files) {
    try {
      const text = await Deno.readTextFile(`./artifacts/${file}`);
      const data = JSON.parse(text) as ModelArtifact;
      if (Array.isArray(data.heads)) {
        allHeads.push(...data.heads);
      }
      if (data.feature_count) featureCount = data.feature_count;
      if (data.version) version = data.version;
    } catch {
      // file may not exist – continue
    }
  }

  if (allHeads.length === 0) {
    // Fallback: try a single known file
    try {
      const text = await Deno.readTextFile("./artifacts/heads_v1.json");
      return JSON.parse(text) as ModelArtifact;
    } catch {
      return null;
    }
  }

  return {
    version,
    feature_count: featureCount,
    heads: allHeads,
  };
}
