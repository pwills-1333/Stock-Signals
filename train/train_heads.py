import argparse
import json
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

def load_csv(path: str):
    df = pd.read_csv(path)
    df = df.dropna()
    return df

def train_ridge_head(X, y, name: str):
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

def train_all_heads(df: pd.DataFrame):
    X = df.iloc[:, :-1].values
    y = df.iloc[:, -1].values

    heads = []

    heads.append(train_ridge_head(X, y, "expected_return"))
    heads.append(train_ridge_head(X, y * 0.5, "momentum"))
    heads.append(train_ridge_head(X, y * -1, "reversal"))
    heads.append(train_ridge_head(X, abs(y), "volatility"))

    return {"heads": heads}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    df = load_csv(args.csv)
    artifact = train_all_heads(df)

    with open(args.out, "w") as f:
        json.dump(artifact, f, indent=2)

if __name__ == "__main__":
    main()
