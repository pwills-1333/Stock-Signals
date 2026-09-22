FROM denoland/deno:2.1.4

WORKDIR /app

COPY deno.json .
COPY src/ ./src/
COPY artifacts/ ./artifacts/

RUN deno cache src/main.ts

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD deno eval "try { const r = await fetch('http://localhost:8000/health'); Deno.exit(r.ok ? 0 : 1); } catch { Deno.exit(1); }"

EXPOSE 8000

CMD ["deno", "run", "-A", "src/main.ts"]
