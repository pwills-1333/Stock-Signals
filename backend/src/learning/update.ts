// backend/src/learning/update.ts
import { clamp } from "../stats.ts";
import {
  updateLearningState,
  projectPsiWeights,
  projectCtrAWeights,
} from "./state.ts";
import type { LearningSnapshot } from "./types.ts";

const ERROR_LAMBDA = 0.7;
const ETA = 0.012;
export const ERROR_CORRECTION_ALPHA = 0.08;
const MIN_RESOLVES_FOR_WEIGHTS = 5;

/**
 * Update per-ticker e_t and (after enough data) global Ψ / CTR-A weights.
 * All mutation happens in one locked updateLearningState call.
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
  const key = snapshot.ticker.toUpperCase();

  let eOut = 0;
  let weightsUpdated = false;

  await updateLearningState((state) => {
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
    eOut = state.tickerErrors[key].e;

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
  });

  return { e: eOut, delta, weightsUpdated };
}
