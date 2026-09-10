import { clamp, logReturns } from "./stats.ts";
import type { Regime } from "./types.ts";

export function hurstRS(series: number[]) {
const n = series.length;
if (n < 20) return 0.5;
let mean = 0;
for (const x of series) mean += x;
mean /= n;
let acc = 0, mn = Infinity, mx = -Infinity, ss = 0;
for (let i = 0; i < n; i++) {
const d = series[i] - mean;
acc += d;
if (acc < mn) mn = acc;
if (acc > mx) mx = acc;
ss += d * d;
}

const s = Math.sqrt(ss / n);
if (s === 0) return 0.5;
return clamp(Math.log((mx - mn) / s) / Math.log(n), 0.1, 0.9);
}

export function computeFractalFeatures(prices: number[]) {
const lr = logReturns(prices);
const H_global = hurstRS(lr);
const D_global = 2 - H_global;
const windows = [32, 64, 128];
const H_multi = windows.map((w) => (lr.length < w ? 0.5 :
hurstRS(lr.slice(-w))));
const spectrumWidth = Math.max(...H_multi) - Math.min(...H_multi);
return { H_global, D_global, H_multi, spectrumWidth };
}

export function fractalModelHead(prices: number[], sentimentScore:
number, garchVol: number) {
const f = computeFractalFeatures(prices);
const H_mean = f.H_multi.reduce((a, b) => a + b, 0) / f.H_multi.length;
const baseTilt =
0.28 * sentimentScore + 0.36 * (f.H_global - 0.5) + 0.36 * (H_mean -
0.5);
const volAdj = garchVol * (1 + 1.1 * f.spectrumWidth);
const expectedReturn = clamp(baseTilt * volAdj, -0.3, 0.3);
const directionProb = 1 / (1 + Math.exp(-baseTilt * 4.2));
const volForecast = garchVol * (1 + 0.55 * (f.D_global - 1.5));
return { expectedReturn, directionProb, volForecast, ...f, H_mean,
baseTilt };
}

export function getRegimeWeights(regime: Regime) {
switch (regime) {
case "trend":
return { ensembleW: 0.35, mcW: 0.25, fractalW: 0.40 };
case "meanReversion":
return { ensembleW: 0.25, mcW: 0.40, fractalW: 0.35 };
case "chaos":
return { ensembleW: 0.30, mcW: 0.45, fractalW: 0.25 };
default:
return { ensembleW: 0.33, mcW: 0.33, fractalW: 0.34 };
}

}

export function computeCTMUFractal(
fractal: { H_global: number; D_global: number; spectrumWidth: number },
regime: Regime,
) {
let telicMod = 0.5 + 0.4 * (fractal.H_global - 0.5);
let hologyMod = 0.5 + 0.3 * (1.7 - fractal.D_global);
let dissonanceMod = 0.5 + 0.6 * fractal.spectrumWidth;
if (regime === "trend") {
telicMod *= 1.1;
hologyMod *= 1.05;
dissonanceMod *= 0.9;
} else if (regime === "meanReversion") {
telicMod *= 0.95;
dissonanceMod *= 1.05;
} else if (regime === "chaos") {
telicMod *= 0.85;
hologyMod *= 0.9;
dissonanceMod *= 1.15;
}

return { telicMod, hologyMod, dissonanceMod };
}
