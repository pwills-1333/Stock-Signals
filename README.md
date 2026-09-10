
# Stock Signal Engine

Hybrid stock prediction API: multi-head ensemble (trained or heuristic),

GARCH + regime-aware Heston MC, fractal blend, adaptive Ψ, CTMU
consistency gate,

screener, outcome resolution, and weight optimization.

**Data sources:** Finnhub (primary for OHLC + company news) with
Yahoo Finance fallback for longer history and reliability.

## Quick start (Deno)

```bash

cp .env.example .env

# Edit .env if needed (FINNHUB_API_KEY is already set as example)

deno task start

API: [http://localhost:8000](http://localhost:8000/)

