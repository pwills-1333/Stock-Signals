import { clamp } from "../stats.ts";
import {
  DEFAULT_PSI_WEIGHTS,
  type PsiInputs,
  type PsiWeights,
  psychBias,
  corePsi,
  extendedPsi,
  psiTotal,
  dynamicPsi,
  psiDrift,
  psiVolatility,
} from "./formulas.ts";

export interface PsiState {
  weights: PsiWeights;
  // Bayesian version
  alpha: Record<keyof PsiWeights, number>;
  beta: Record<keyof PsiWeights, number>;
  history: number[];
  lastTotal: number;
  mode: "basic" | "bayesian";
}

export function createPsiSession(base?: PsiState): { state: PsiState; snapshot: () => PsiState } {
  const state: PsiState = base
    ? structuredClone(base)
    : {
        weights: { ...DEFAULT_PSI_WEIGHTS },
        alpha: { ws: 5, we: 5, wc: 5, wm: 5, wt: 5 },
        beta: { ws: 5, we: 5, wc: 5, wm: 5, wt: 5 },
        history: [],
        lastTotal: 0,
        mode: "bayesian",
      };

  return {
    state,
    snapshot: () => structuredClone(state),
  };
}

function renormalize(w: PsiWeights) {
  const sum = w.ws + w.we + w.wc + w.wm + w.wt || 1;
  w.ws /= sum; w.we /= sum; w.wc /= sum; w.wm /= sum; w.wt /= sum;
}

/** Adaptation 1 – Basic utility-driven */
function updateBasic(state: PsiState, error: number, coherence: number) {
  const eta = 0.04;
  const utility = -0.7 * error + 0.3 * coherence;
  const keys: (keyof PsiWeights)[] = ["ws", "we", "wc", "wm", "wt"];
  for (const k of keys) {
    state.weights[k] = clamp(state.weights[k] + eta * utility, 0.05, 0.5);
  }
  renormalize(state.weights);
}

/** Adaptation 2 – Bayesian-modulated */
function updateBayesian(state: PsiState, error: number, coherence: number, psiVal: number) {
  const errorScore = Math.exp(-3 * Math.abs(error));
  const cohScore = (coherence + 1) / 2;
  let lik = 0.65 * errorScore + 0.35 * cohScore;
  lik = clamp(lik * (1 + 0.45 * Math.tanh(psiVal)), 0.05, 0.95);

  const lambda = 0.35;
  const keys: (keyof PsiWeights)[] = ["ws", "we", "wc", "wm", "wt"];
  for (const k of keys) {
    state.alpha[k] += lambda * (2 * lik - 1);
    state.beta[k] -= lambda * (2 * lik - 1);
    // soft forgetting
    state.alpha[k] *= 0.995;
    state.beta[k] *= 0.995;
    state.alpha[k] = Math.max(1.1, state.alpha[k]);
    state.beta[k] = Math.max(1.1, state.beta[k]);
    // mean of Beta
    state.weights[k] = state.alpha[k] / (state.alpha[k] + state.beta[k]);
  }
  renormalize(state.weights);
}

export function runPsi(
  state: PsiState,
  inputs: PsiInputs,
  opts: { error?: number; coherence?: number } = {},
) {
  const psych = psychBias(inputs.S, inputs.corr, inputs.vol);
  const core = corePsi(inputs, state.weights);
  const extended = extendedPsi(core, inputs.T, state.weights.wt);
  let total = psiTotal(psych, core, extended);

  // dynamic update
  total = dynamicPsi(state.lastTotal, total, opts.error ?? 0, opts.coherence ?? 0.5);
  state.lastTotal = total;
  state.history.push(total);
  if (state.history.length > 60) state.history.shift();

  // self-configuring
  if (opts.error !== undefined && opts.coherence !== undefined) {
    if (state.mode === "bayesian") {
      updateBayesian(state, opts.error, opts.coherence, total);
    } else {
      updateBasic(state, opts.error, opts.coherence);
    }
  }

  return {
    psych,
    core,
    extended,
    total,
    drift: psiDrift(total),
    volMult: psiVolatility(1, total),
    weights: { ...state.weights },
    s: inputs.S,
    e: inputs.E,
    c: inputs.C,
    m: inputs.M,
    t: inputs.T,
    scalar: psych,
  };
}
