FROM denoland/deno:2.1.4

WORKDIR /app

# Copy only what we need
COPY deno.json .
COPY src/ ./src/
COPY artifacts/ ./artifacts/

# Cache dependencies
RUN deno cache src/main.ts

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD deno eval "try { const r = await fetch('http://localhost:8000/health'); Deno.exit(r.ok ? 0 : 1); } catch { Deno.exit(1); }"

EXPOSE 8000

# Railway sets PORT automatically
CMD ["deno", "run", "-A", "--env", "src/main.ts"]
