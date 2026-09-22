# Stock Signal Engine (Ψ + CTR-A)

Hybrid stock prediction API with adaptive psychological bias (Ψ) and Coherence Theory of Reality (CTR-A) gate.

**Data sources:** Finnhub (primary) → Yahoo Finance fallback  
**Stack:** Deno + Oak (backend) · simple Express static frontend

## Features

- Multi-head Ridge model ensemble
- Regime detection (trend / mean-reversion / chaos / volatility…)
- Adaptive Ψ psychological bias layer
- CTR-A coherence gate
- ATR-based stop-loss & take-profit
- Short-term OHLC caching
- Universe screening endpoint

## Railway Deploy (Recommended)

1. Push this repo to GitHub
2. Create a new project on [Railway](https://railway.app) → Deploy from GitHub
3. Select the `backend` folder as the root (or set Root Directory to `backend`)
4. Add the following environment variables:
   - `FINNHUB_API_KEY` = your Finnhub key (required for best results)
   - `PORT` is set automatically by Railway
5. Deploy

After deploy, copy the public URL and update `API_BASE` in `frontend/public/index.html`.

## Local Development

```bash
cd backend
cp .env.example .env
# edit .env and add your FINNHUB_API_KEY

deno task start
# or
deno task dev
