const healthEl = document.getElementById("health");
const searchForm = document.getElementById("search-form");
const hitsEl = document.getElementById("hits");
const predictForm = document.getElementById("predict-form");
const scanBtn = document.getElementById("scan-us");
const resolveBtn = document.getElementById("resolve");
const optimizeBtn = document.getElementById("optimize");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const tickerEl = document.getElementById("ticker");
const horizonEl = document.getElementById("horizon");

function show(data) {
  resultEl.textContent = JSON.stringify(data, null, 2);
}

function addHit(label, ticker) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.addEventListener("click", () => {
    tickerEl.value = ticker;
  });
  hitsEl.appendChild(btn);
}

async function refreshHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    const parts = [
      data.ok ? "engine online" : "engine degraded",
      data.finnhub ? "Finnhub on" : "Finnhub off",
      data.artifacts ? "ridge artifacts on" : "heuristic heads",
      `${data.predictions ?? 0} saved`,
      `${data.due ?? 0} due`,
      `${data.accuracy ?? 0} resolved`,
      data.weightsReady ? "weights live" : "default weights",
    ];
    healthEl.textContent = parts.join(" · ");
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
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  show(data);
  statusEl.textContent = res.ok
    ? `Exact ${path} response below.`
    : `Engine error (HTTP ${res.status}).`;
  await refreshHealth();
  return data;
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const q = document.getElementById("query").value.trim();
  hitsEl.textContent = "";
  statusEl.textContent = "Searching US symbols…";
  try {
    const res = await fetch(`/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    show(data);
    if (!data.results?.length) {
      statusEl.textContent = data.finnhub ? "No symbol matches." : "Search needs Finnhub.";
      return;
    }
    statusEl.textContent = "Pick a symbol, then run the algorithm.";
    for (const hit of data.results) {
      addHit(`${hit.symbol} ${hit.description || ""}`.trim(), hit.symbol);
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
  hitsEl.textContent = "";
  try {
    const data = await postEngine("/screen", {
      universe: [],
      horizonDays: Number(horizonEl.value) || 14,
      limit: 12,
    }, "Scanning US names through the engine. This can take a minute.");
    for (const pick of data.picks || []) {
      addHit(`${pick.ticker} ${pick.signal || ""} ${pick.grade || ""}`.trim(), pick.ticker);
    }
    if (data.picks?.length) {
      statusEl.textContent = "Exact /screen response below. Click a pick, then run the algorithm.";
    }
  } catch (err) {
    statusEl.textContent = String(err.message || err);
  }
});

resolveBtn.addEventListener("click", async () => {
  try {
    await postEngine("/resolve", {}, "Resolving due predictions against Yahoo…");
  } catch (err) {
    statusEl.textContent = String(err.message || err);
  }
});

optimizeBtn.addEventListener("click", async () => {
  try {
    await postEngine("/optimize/weights", {}, "Optimizing ensemble weights from resolved rows…");
  } catch (err) {
    statusEl.textContent = String(err.message || err);
  }
});

refreshHealth();
setInterval(refreshHealth, 30000);
