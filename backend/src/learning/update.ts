// backend/src/learning/update.ts
import { clamp } from "../stats.ts";
import {
  loadLearningState,
  saveLearningState,
  projectPsiWeights,
  projectCtrAWeights,
} from "./state.ts";
import type { LearningSnapshot } from "./types.ts";

/** EMA on per-ticker error */
const ERROR_LAMBDA = 0.7;
/** Learning rate for global weights */
const ETA = 0.012;
/** Scale of recursive correction injected into CTR-A */
export const ERROR_CORRECTION_ALPHA = 0.08;
/** Min global resolves before weight updates (error e_t always updates) */
const MIN_RESOLVES_FOR_WEIGHTS = 5;

/**
 * Update per-ticker e_t and (after enough data) global Ψ / CTR-A weights.
 *
 * δ = predictedReturn - actualReturn
 * e_t = λ e_{t-1} + (1-λ) δ
 * w_i ← w_i - η * sign(δ) * x_i   then project + normalize
 */
export async function learnFromOutcome(
  snapshot: LearningSnapshot,
  actualReturn: number,
): Promise<{
  e: number;
  delta: number;
  weightsUpdated: boolean;
}> {
  const predicted = snapshot.expectedReturn;
  const delta = predicted - actualReturn;

  const state = await loadLearningState();
  const key = snapshot.ticker.toUpperCase();
  const prev = state.tickerErrors[key];
  const prevE = prev?.e ?? 0;
  const prevN = prev?.n ?? 0;

  const e = ERROR_LAMBDA * prevE + (1 - ERROR_LAMBDA) * delta;

  state.tickerErrors[key] = {
    e: clamp(e, -0.25, 0.25),
    n: prevN + 1,
    updatedAt: new Date().toISOString(),
  };
  state.globalResolveCount += 1;

  let weightsUpdated = false;

  if (state.globalResolveCount >= MIN_RESOLVES_FOR_WEIGHTS) {
    const sign = delta > 0 ? 1 : delta < 0 ? -1 : 0;
    if (sign !== 0) {
      const pc = snapshot.psiComponents;
      const psiW = { ...state.globalPsiWeights };
      psiW.r -= ETA * sign * pc.r;
      psiW.c -= ETA * sign * pc.c;
      psiW.v -= ETA * sign * pc.v;
      psiW.t -= ETA * sign * pc.t;
      psiW.ch -= ETA * sign * pc.ch;
      state.globalPsiWeights = projectPsiWeights(psiW);

      const cc = snapshot.ctrAComponents;
      const ctrW = { ...state.globalCtrAWeights };
      ctrW.temporal -= ETA * sign * cc.temporal;
      ctrW.recursive -= ETA * sign * cc.recursive;
      ctrW.fractal -= ETA * sign * cc.fractal;
      ctrW.psi -= ETA * sign * cc.psi;
      state.globalCtrAWeights = projectCtrAWeights(ctrW);

      weightsUpdated = true;
    }
  }

  await saveLearningState(state);

  return {
    e: state.tickerErrors[key].e,
    delta,
    weightsUpdated,
  };
}
