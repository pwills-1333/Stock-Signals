
"""Train portable ridge heads → artifacts/heads_v1.json for the Deno
API."""

import argparse

import json

from pathlib import Path

import numpy as np

import pandas as pd

from sklearn.linear_model import Ridge

from sklearn.model_selection import TimeSeriesSplit

from sklearn.metrics import mean_absolute_error

FEATURE_NAMES = [

"rsi", "macdHist", "smaSpread20_50", "smaSpread50_200",

"mom5", "mom10", "mom20", "vol20", "volRatio",

"sentiment", "volumeRatio", "hurst", "ret1", "ret5",

]

HORIZON = 14

def rsi(closes, period=14):

d = np.diff(closes)

up = np.where(d > 0, d, 0.0)

dn = np.where(d < 0, -d, 0.0)

out = np.full(len(closes), 50.0)

for i in range(period, len(closes)):

au = up[i - period : i].mean()

ad = dn[i - period : i].mean()

rs = au / (ad + 1e-12)

out[i] = 100 - 100 / (1 + rs)

return out

def simple_macd_hist(closes, fast=12, slow=26):

if len(closes) < slow + 5:

return 0.0

def ema(series, n):

k = 2 / (n + 1)

e = series[0]

for x in series[1:]:

e = x * k + e * (1 - k)

return e

return (ema(closes, fast) - ema(closes, slow)) * 0.3

def simple_hurst(closes):

if len(closes) < 40:

return 0.5

r = np.diff(np.log(np.maximum(closes, 1e-9)))

n = len(r)

mean = r.mean()

acc = np.cumsum(r - mean)

R = acc.max() - acc.min()

S = r.std() + 1e-12

H = np.log(R / S) / np.log(n) if R > 0 else 0.5

return float(np.clip(H, 0.1, 0.9))

def build_rows(df: pd.DataFrame):

c = df["close"].values.astype(float)

v = df["volume"].values.astype(float) if "volume" in df.columns
else np.ones(len(c))

sent = df["sentiment"].values.astype(float) if "sentiment" in
df.columns else np.zeros(len(c))

r = rsi(c)

X, y = [], []

for i in range(60, len(c) - HORIZON):

last = c[i]

def ret(a, b):

return (a - b) / b if b else 0.0

window = c[: i + 1]

rets = np.diff(np.log(np.maximum(window[-21:], 1e-9)))

vol20 = float(np.std(rets[-20:])) if len(rets) >= 5 else 0.02

avg_vol = v[max(0, i - 30) : i + 1].mean() or 1.0

macd_h = simple_macd_hist(window)

hurst_val = simple_hurst(window)

feat = [

r[i] / 100.0,

float(np.clip(macd_h / (last or 1), -0.05, 0.05)),

ret(np.mean(window[-20:]), np.mean(window[-50:]) if i >= 50 else
last),

ret(

np.mean(window[-50:]) if i >= 50 else last,

np.mean(window[-min(200, i) :]) if i >= 20 else last,

),

ret(last, window[-6]),

ret(last, window[-11]),

ret(last, window[-21]),

vol20,

1.0,

float(np.clip(sent[i], -1, 1)),

float(np.clip(v[i] / avg_vol, 0, 5) / 5.0),

hurst_val,

ret(last, window[-2]),

ret(last, window[-6]),

]

fwd = (c[i + HORIZON] - last) / last

if np.isfinite(fwd) and abs(fwd) < 0.8:

X.append(feat)

y.append(fwd)

return np.array(X), np.array(y)

def main():

ap = argparse.ArgumentParser()

ap.add_argument("--csv", required=True, help="CSV with columns:
close, volume[, sentiment]")

ap.add_argument("--out", default="../artifacts/heads_v1.json")

args = ap.parse_args()

df = pd.read_csv(args.csv)

X, y = build_rows(df)

if len(X) < 100:

raise SystemExit(f"Not enough rows: {len(X)}")

tscv = TimeSeriesSplit(n_splits=5)

maes = []

for tr, te in tscv.split(X):

m = Ridge(alpha=1.0).fit(X[tr], y[tr])

maes.append(mean_absolute_error(y[te], m.predict(X[te])))

print("Walk-forward MAE:", float(np.mean(maes)))

model = Ridge(alpha=1.0).fit(X, y)

art = {

"version": 1,

"horizonDays": HORIZON,

"feature_names": FEATURE_NAMES,

"ridge_features": {

"coef": model.coef_.tolist(),

"intercept": float(model.intercept_),

},

"mae": float(np.mean(maes)),

"samples": int(len(X)),

}

out = Path(args.out)

out.parent.mkdir(parents=True, exist_ok=True)

out.write_text(json.dumps(art, indent=2))

print("Wrote", out)

if __name__ == "__main__":

main()

