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
