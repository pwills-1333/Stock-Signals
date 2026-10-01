# Stock Signal Engine (Ψ + CTR-A)

Hybrid stock prediction API with adaptive psychological bias (Ψ) and Coherence Theory of Reality (CTR-A) gate.

**Data sources:** Finnhub (primary) → Yahoo Finance fallback  
**Stack:** Deno + Oak (backend) · Express static frontend

## Features

- Multi-head Ridge model ensemble
- Regime detection (trend / mean-reversion / chaos / volatility…)
- Adaptive Ψ psychological bias layer
- CTR-A coherence gate
- ATR-based stop-loss & take-profit
- Short-term OHLC caching
- Universe screening endpoint
- Basic per-IP rate limiting

## Railway Deploy (Recommended)

### Backend

1. Push this repo to GitHub.
2. Create a new project on [Railway](https://railway.app) → **Deploy from GitHub**.
3. Set **Root Directory** to `backend`.
4. Add environment variable:
   - `FINNHUB_API_KEY` = your Finnhub key (required for best results)
5. Deploy. Railway sets `PORT` automatically.
6. Copy the public URL (e.g. `https://your-service.up.railway.app`).

### Frontend

1. Open `frontend/public/index.html`.
2. Set `API_BASE` to your backend public URL (**no trailing slash**).
3. Either:
   - Deploy the `frontend` folder as a second Railway service (Node, start command: `npm start`), **or**
   - Host the static files anywhere (GitHub Pages, Cloudflare Pages, etc.).

### Health

- Endpoint: `GET /health`
- Railway healthcheck is configured via `backend/railway.toml`.

## Local Development

```bash
cd backend
cp .env.example .env
# edit .env and add your FINNHUB_API_KEY

deno task start
# or with auto-reload:
deno task dev

## Learning loop (Ψ / CTR-A)

Predictions are saved under `DATA_DIR` with a `learningSnapshot`.

1. **Predict**  
   `POST /predict` `{ "ticker": "AAPL", "horizonDays": 14 }` → response includes `id`

2. **Resolve** (after horizon, or `force: true` for tests)  
   - `POST /resolve` `{ "id": "<uuid>", "actualPrice": 190.5 }`  
   - or `POST /resolve-due` `{ "limit": 20 }` for all due predictions  

3. Outcomes update per-ticker error `e_t` and global Ψ / CTR-A weights.

### Environment

| Variable | Purpose |
|----------|---------|
| `FINNHUB_API_KEY` | OHLC + company news |
| `DATA_DIR` | Predictions + learning JSON (default `./data`) |
| `RESOLVE_SECRET` | If set, resolve endpoints need header `X-Resolve-Secret` |
| `PROTECT_LEARNING_STATE` | If `true`, `GET /learning/state` also needs that header |
| `RESOLVE_DUE_INTERVAL_MS` | In-process auto resolve-due (`0` = off; `86400000` = daily) |
| `RESOLVE_DUE_LIMIT` | Max items per auto/batch resolve (default 20) |

### Production (Railway / Docker)

1. Mount a **persistent volume** at `/app/data` (or your `DATA_DIR`).
2. Set `RESOLVE_DUE_INTERVAL_MS=86400000` **or** external cron → `POST /resolve-due`.
3. Set `RESOLVE_SECRET` if the API is reachable publicly.

### Locks

Process-local `withLock` is **not re-entrant**. Do not call locked store/learning helpers from inside another `withLock` callback.
