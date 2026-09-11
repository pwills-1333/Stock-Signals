const healthEl = document.getElementById("health");
const predictForm = document.getElementById("predict-form");
const predictStatus = document.getElementById("predict-status");
const predictResult = document.getElementById("predict-result");
const screenForm = document.getElementById("screen-form");
const screenStatus = document.getElementById("screen-status");
const screenResult = document.getElementById("screen-result");

function money(n) {
  return Number(n).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function pct(n) {
  return `${(Number(n) * 100).toFixed(2)}%`;
}

function setStatus(el, text, isError = false) {
  el.hidden = !text;
  el.textContent = text || "";
  el.classList.toggle("error", isError);
}

async function refreshHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    healthEl.textContent = data.ok ? "online" : "degraded";
    healthEl.className = `health ${data.ok ? "ok" : "bad"}`;
  } catch {
    healthEl.textContent = "offline";
    healthEl.className = "health bad";
  }
}

function metric(label, value, extraClass = "") {
  return `<div class="metric"><span>${label}</span><strong class="${extraClass}">${value}</strong></div>`;
}

function renderPrediction(data) {
  const p = data.prediction || data;
  const signalClass = `signal-${p.signal || ""}`;
  predictResult.innerHTML = `
    <div class="grid">
      ${metric("Ticker", p.ticker || "—")}
      ${metric("Signal", p.signal || "—", signalClass)}
      ${metric("Grade", p.tradeGrade || "—")}
      ${metric("Entry", money(p.entryPrice))}
      ${metric("Predicted", money(p.predictedPrice))}
      ${metric("Expected return", pct(p.expectedReturn))}
      ${metric("Confidence", pct(p.confidence))}
      ${metric("Regime", p.regime || "—")}
      ${metric("Quality", Number(p.signalQuality || 0).toFixed(3))}
      ${metric("Telic", Number(p.ctmu?.telic || 0).toFixed(3))}
      ${metric("Hology", Number(p.ctmu?.hology || 0).toFixed(3))}
      ${metric("Dissonance", Number(p.ctmu?.dissonance || 0).toFixed(3))}
    </div>
    <p class="rationale">${p.rationale || ""}</p>
  `;
}

function renderScreen(data) {
  const picks = data.picks || [];
  if (!picks.length) {
    screenResult.innerHTML = `<p class="status">No picks returned.</p>`;
    return;
  }
  const rows = picks.map((p) => `
    <tr>
      <td>${p.ticker}</td>
      <td class="signal-${p.signal || ""}">${p.signal}</td>
      <td>${p.grade || "—"}</td>
      <td>${pct(p.expectedReturn || 0)}</td>
      <td>${pct(p.confidence || 0)}</td>
      <td>${p.regime || "—"}</td>
    </tr>
  `).join("");
  screenResult.innerHTML = `
    <p class="status">Scanned ${data.scanned ?? picks.length} · ${picks.length} picks · ${data.modelSource || ""}</p>
    <table>
      <thead>
        <tr><th>Ticker</th><th>Signal</th><th>Grade</th><th>Return</th><th>Conf</th><th>Regime</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

predictForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  predictResult.innerHTML = "";
  setStatus(predictStatus, "Running prediction…");
  try {
    const res = await fetch("/predict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ticker: document.getElementById("ticker").value,
        horizonDays: Number(document.getElementById("horizon").value) || 14,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Prediction failed");
    setStatus(predictStatus, "");
    renderPrediction(data);
  } catch (err) {
    setStatus(predictStatus, String(err.message || err), true);
  }
});

screenForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  screenResult.innerHTML = "";
  setStatus(screenStatus, "Scanning universe… this can take a minute.");
  const universe = document.getElementById("universe").value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  try {
    const res = await fetch("/screen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        universe,
        horizonDays: Number(document.getElementById("screen-horizon").value) || 14,
        limit: 12,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Screen failed");
    setStatus(screenStatus, "");
    renderScreen(data);
  } catch (err) {
    setStatus(screenStatus, String(err.message || err), true);
  }
});

refreshHealth();
setInterval(refreshHealth, 30000);
