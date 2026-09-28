# backend/train/train_heads.py
"""
Train simple multi-head Ridge models.
Features must already be price-normalized (same as production mlFeatures.ts).
"""

import argparse
import json
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

def load_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    return df.dropna()

def train_ridge_head(X, y, name: str) -> dict:
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("ridge", Ridge(alpha=1.0))
    ])
    model.fit(X, y)

    ridge = model.named_steps["ridge"]
    scaler = model.named_steps["scaler"]

    return {
        "name": name,
        "coef": ridge.coef_.tolist(),
        "intercept": float(ridge.intercept_),
        # Optional: store scaler so inference can apply it later
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
    }

def train_all_heads(df: pd.DataFrame) -> dict:
    X = df.iloc[:, :-1].values
    y = df.iloc[:, -1].values

    heads = []
    heads.append(train_ridge_head(X, y, "expected_return"))
    heads.append(train_ridge_head(X, y * 0.7, "momentum"))
    heads.append(train_ridge_head(X, y * -0.8, "reversal"))
    heads.append(train_ridge_head(X, abs(y), "volatility_proxy"))

    return {
        "version": "1.1.0-price-norm",
        "feature_count": int(X.shape[1]),
        "heads": heads,
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    df = load_csv(args.csv)
    artifact = train_all_heads(df)

    with open(args.out, "w") as f:
        json.dump(artifact, f, indent=2)

    print(f"Saved {len(artifact['heads'])} heads → {args.out}")

if __name__ == "__main__":
    main()
