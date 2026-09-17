# Stock Signal Engine (Ψ + CTR-A)

Hybrid stock prediction API with adaptive psychological bias (Ψ) and Coherence Theory of Reality (CTR-A) gate.

**Data sources:** Finnhub (primary) → Yahoo Finance fallback + freenewsapi.ai + optional Google CSE / X.

## Railway Deploy
1. Push this repo to GitHub
2. New Project → Deploy from GitHub
3. Add `FINNHUB_API_KEY` (and optional keys) in Variables
4. Deploy

## Local
```bash
cp .env.example .env
deno task start
