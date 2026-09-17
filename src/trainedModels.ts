import { ARTIFACTS_PATH } from "./config.ts";

let cached: any = null;

export async function loadModelArtifacts() {
  if (cached) return cached;
  try {
    const text = await Deno.readTextFile(ARTIFACTS_PATH);
    cached = JSON.parse(text);
    console.log("Loaded trained heads from", ARTIFACTS_PATH);
    return cached;
  } catch {
    console.log("No trained artifacts found – using heuristic heads");
    return null;
  }
}

export function predictWithArtifact(artifact: any, features: number[]): number {
  if (!artifact?.ridge_features) return 0;
  const { coef, intercept } = artifact.ridge_features;
  let y = intercept;
  for (let i = 0; i < coef.length && i < features.length; i++) {
    y += coef[i] * features[i];
  }
  return y;
}
