import { clamp } from "./stats.ts";

const FACTORS = ["s", "e", "c", "m", "t"] as const;
type Factor = (typeof FACTORS)[number];
const LOOKBACK = 60;
const LEARNING_STRENGTH = 0.08;
const COHERENCE_THRESHOLD = 0.30;
const MIN_WEIGHT = 0.02;
const MAX_WEIGHT = 0.60;
const FORGET = 0.995;
const DEFAULT_AB = 12;
export type PsiState = {
alpha: Record<Factor, number>;
beta: Record<Factor, number>;
history: { psi: number[]; coherence: number[]; error: number[] };
};

function freshState(): PsiState {
const alpha = {} as Record<Factor, number>;
const beta = {} as Record<Factor, number>;
for (const k of FACTORS) {
alpha[k] = DEFAULT_AB;
beta[k] = DEFAULT_AB;
}

return { alpha, beta, history: { psi: [], coherence: [], error: []
} };
}

let globalState = freshState();
export function clonePsiState(src: PsiState): PsiState {
return {
alpha: { ...src.alpha },
beta: { ...src.beta },
history: {
psi: [...src.history.psi],
coherence: [...src.history.coherence],
error: [...src.history.error],
},
};

}

function getWeights(state: PsiState) {
const raw: Record<string, number> = {};
for (const k of FACTORS) {
const mean = state.alpha[k] / (state.alpha[k] + state.beta[k]);
raw[k] = MIN_WEIGHT + mean * (MAX_WEIGHT - MIN_WEIGHT);
}

const total = FACTORS.reduce((s, k) => s + raw[k], 0) || 1;
const out: Record<string, number> = {};
for (const k of FACTORS) out[k] = raw[k] / total;
return out;
}

function bayesianUpdate(
state: PsiState,
error: number,
coherence: number,
psiTotal: number,
) {
const errorScore = Math.exp(-3 * Math.abs(error));
const cohScore = coherence;
const lik = clamp(
(0.65 * errorScore + 0.35 * cohScore) * (1 + 0.45 *
Math.tanh(psiTotal)),
0.05,
0.95,
);

const psiPrime = clamp((lik - 0.5) * 2, -1, 1);
for (const k of FACTORS) {
const evidence = LEARNING_STRENGTH * psiPrime;
state.alpha[k] = Math.max(1.5, state.alpha[k] + evidence) * FORGET;
state.beta[k] = Math.max(1.5, state.beta[k] - evidence) * FORGET;
}

if (coherence < COHERENCE_THRESHOLD) {
for (const k of FACTORS) {
const mid = (state.alpha[k] + state.beta[k]) / 2;
state.alpha[k] = 0.5 * state.alpha[k] + 0.5 * mid;
state.beta[k] = 0.5 * state.beta[k] + 0.5 * mid;
}

}

return psiPrime;
}

export function updateAdaptivePsiOn(
state: PsiState,
input: {
S: number;
E: number;
C: number;
M: number;
T: number;
structuralSignal?: number;
prevPrediction?: number;
},
) {
const w = getWeights(state);
const eRaw = input.E * Math.sign(input.S || 0.01);
const t = input.T - 0.5;
const psych = clamp(
w.s * input.S + w.e * eRaw + w.c * input.C + w.m * input.M + w.t *
t,
-1,
1,
);

let coherence = 0;
if (state.history.psi.length > 8) {
const recent = state.history.psi.slice(-25);
const meanPsi = recent.reduce((a, b) => a + b, 0) / recent.length;
const ss = clamp(input.structuralSignal ?? meanPsi, -1, 1);
coherence = clamp(1 - Math.abs(meanPsi - ss), 0, 1);
}

const error =
input.prevPrediction !== undefined
? clamp((input.structuralSignal ?? 0) - input.prevPrediction, -1, 1)
: 0;
bayesianUpdate(state, error, coherence, psych);
state.history.psi.push(psych);
state.history.coherence.push(coherence);
state.history.error.push(error);
if (state.history.psi.length > LOOKBACK) {
state.history.psi.shift();
state.history.coherence.shift();
state.history.error.shift();
}

const weightUncertainty: Record<string, number> = {};
for (const k of FACTORS) weightUncertainty[k] = 1 /
(state.alpha[k] + state.beta[k]);
return {
psiTotal: psych,
psych,
psi: clamp((psych + 1) / 2, 0, 1),
psiPrime: clamp(Math.tanh(psych * 2), -1, 1),
weights: w,
weightUncertainty,
coherence,
error,
bayesModulation: clamp(0.5 + 0.5 * psych, 0, 1),
};

}

export function getAdaptiveWeights(state: PsiState = globalState) {
const weightUncertainty: Record<string, number> = {};
for (const k of FACTORS) weightUncertainty[k] = 1 /
(state.alpha[k] + state.beta[k]);
return { weights: getWeights(state), weightUncertainty };
}

export function createPsiSession(from: PsiState = globalState) {
const state = clonePsiState(from);
return {
state,
update: (input: Parameters<typeof updateAdaptivePsiOn>[1]) =>
updateAdaptivePsiOn(state, input),
getWeights: () => getAdaptiveWeights(state),
snapshot: () => clonePsiState(state),
};

}

export function getGlobalPsiState() {
return globalState;
}

export function setGlobalPsiState(s: PsiState) {
globalState = s;
}
