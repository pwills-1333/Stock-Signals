```
# Stock Signals

A hybrid stock‑prediction engine and dashboard UI.  
Backend powered by Deno; frontend served as a lightweight static site.

## 🚀 Features
- Multi‑head ensemble predictions (trained + heuristic)
- GARCH + regime‑aware Heston Monte Carlo
- Fractal blend + adaptive Ψ
- CTMU consistency gate
- Screener for scanning stock universes
- Outcome resolution + weight optimization
- Finnhub primary data source with Yahoo fallback

## 📦 Project Structure
```
src/
  adaptivePsi.ts
  config.ts
  ctmu.ts
  finnhub.ts
  fractal.ts
  main.ts
  mlFeatures.ts
  models.ts
  optimizer.ts
  pipeline.ts
  routes.ts
  scanner.ts
  stats.ts
  store.ts
  trainedModels.ts
  types.ts
  yahoo.ts

web/
  index.html
  dashboard.js
  styles.css
```

## 🔧 Environment Setup

Create a `.env` file:

```
FINNHUB_API_KEY=your_key_here
```

## ▶️ Running Locally

### Backend (Deno)
```
cp .env.example .env
deno task start
```

API will run at:
```
http://localhost:8000
```

### Frontend
```
cd web
python3 -m http.server 5500
```

Open:
```
http://localhost:5500
```

## 🌐 Deployment

### Backend
Deploy to **Railway** or **Deno Deploy**:
- Add `FINNHUB_API_KEY` as an environment variable
- Point entry to `src/main.ts`

### Frontend
Deploy to:
- Netlify  
- Vercel  
- GitHub Pages  

Set dashboard API endpoint to your deployed backend URL.

## 📄 License
MIT
```

---
