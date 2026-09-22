# backend/train/train_heads.py
"""
Simple Ridge-head trainer for Stock-Signals.

Usage:
  python train_heads.py --csv your_features.csv --out ../artifacts/heads_new.json

The CSV should have:
  - Feature columns first
  - Target column (future return) as the last column

This script creates several simple heads by transforming the target.
For serious use you should implement proper walk-forward validation
and more sophisticated models.
"""

import argparse
import json
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

def load_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df.dropna()
    return df

def train_ridge_head(X, y, name: str) -> dict:
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("ridge", Ridge(alpha=1.0))
    ])
    model.fit(X, y)

    ridge = model.named_steps["ridge"]
    return {
        "name": name,
        "coef": ridge.coef_.tolist(),
        "intercept": float(ridge.intercept_)
    }

def train_all_heads(df: pd.DataFrame) -> dict:
    X = df.iloc[:, :-1].values
    y = df.iloc[:, -1].values

    heads = []

    # Main expected-return head
    heads.append(train_ridge_head(X, y, "expected_return"))

    # Simple variations (these are just examples)
    heads.append(train_ridge_head(X, y * 0.7, "momentum"))
    heads.append(train_ridge_head(X, y * -0.8, "reversal"))
    heads.append(train_ridge_head(X, abs(y), "volatility_proxy"))

    return {
        "version": "1.0.0-simple",
        "feature_count": X.shape[1],
        "heads": heads
    }

def main():
    parser = argparse.ArgumentParser(description="Train simple Ridge heads")
    parser.add_argument("--csv", required=True, help="Path to features CSV")
    parser.add_argument("--out", required=True, help="Output JSON path")
    args = parser.parse_args()

    df = load_csv(args.csv)
    artifact = train_all_heads(df)

    with open(args.out, "w") as f:
        json.dump(artifact, f, indent=2)

    print(f"Saved {len(artifact['heads'])} heads → {args.out}")

if __name__ == "__main__":
    main()
