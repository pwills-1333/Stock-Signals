// frontend/frontend-server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.static(path.join(__dirname, "public")));

// SPA fallback – serve index.html for any non-file route
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = Number(process.env.PORT) || 3000;

// Bind to 0.0.0.0 so Railway/Docker can reach the service
app.listen(port, "0.0.0.0", () => {
  console.log(`Frontend running on http://0.0.0.0:${port}`);
});
