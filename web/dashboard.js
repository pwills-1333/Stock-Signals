const healthEl = document.getElementById("health");
const form = document.getElementById("predict-form");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

async function refreshHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    healthEl.textContent = data.ok ? "engine online" : "engine degraded";
  } catch {
    healthEl.textContent = "engine offline";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Running /predict…";
  resultEl.textContent = "";
  const body = {
    ticker: document.getElementById("ticker").value,
    horizonDays: Number(document.getElementById("horizon").value) || 14,
  };
  try {
    const res = await fetch("/predict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    resultEl.textContent = JSON.stringify(data, null, 2);
    statusEl.textContent = res.ok
      ? "Exact engine response below."
      : `Engine error (HTTP ${res.status}).`;
  } catch (err) {
    statusEl.textContent = String(err.message || err);
  }
});

refreshHealth();
setInterval(refreshHealth, 30000);
