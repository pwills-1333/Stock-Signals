const healthEl = document.getElementById("health");
const searchForm = document.getElementById("search-form");
const searchHits = document.getElementById("search-hits");
const predictForm = document.getElementById("predict-form");
const scanBtn = document.getElementById("scan-us");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const tickerEl = document.getElementById("ticker");
const horizonEl = document.getElementById("horizon");

function show(data) {
  resultEl.textContent = JSON.stringify(data, null, 2);
}

async function refreshHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    const feed = data.finnhub ? "Finnhub US list on" : "Finnhub key missing; US scan uses fallback names";
    healthEl.textContent = data.ok ? `engine online · ${feed}` : "engine degraded";
  } catch {
    healthEl.textContent = "engine offline";
  }
}

async function postEngine(path, body, label) {
  statusEl.textContent = label;
  resultEl.textContent = "";
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  show(data);
  statusEl.textContent = res.ok
    ? `Exact ${path} response below.`
    : `Engine error (HTTP ${res.status}).`;
  return data;
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const q = document.getElementById("query").value.trim();
  searchHits.textContent = "";
  statusEl.textContent = "Searching US symbols…";
  try {
    const res = await fetch(`/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    show(data);
    if (!data.finnhub) {
      statusEl.textContent = "Symbol search needs FINNHUB_API_KEY on Railway. Type a ticker and run the algorithm instead.";
      return;
    }
    if (!data.results.length) {
      statusEl.textContent = "No symbol matches.";
      return;
    }
    statusEl.textContent = "Pick a symbol, then run the algorithm.";
    for (const hit of data.results) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${hit.symbol} ${hit.description || ""}`.trim();
      btn.addEventListener("click", () => {
        tickerEl.value = hit.symbol;
      });
      searchHits.appendChild(btn);
    }
  } catch (err) {
    statusEl.textContent = String(err.message || err);
  }
});

predictForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await postEngine("/predict", {
      ticker: tickerEl.value,
      horizonDays: Number(horizonEl.value) || 14,
    }, "Running /predict…");
  } catch (err) {
    statusEl.textContent = String(err.message || err);
  }
});

scanBtn.addEventListener("click", async () => {
  try {
    await postEngine("/screen", {
      universe: [],
      horizonDays: Number(horizonEl.value) || 14,
      limit: 12,
    }, "Scanning US names through the engine. This can take a minute.");
  } catch (err) {
    statusEl.textContent = String(err.message || err);
  }
});

refreshHealth();
setInterval(refreshHealth, 30000);
