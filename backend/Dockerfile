FROM denoland/deno:2.1.4

WORKDIR /app

COPY backend/deno.json .
COPY backend/src/ ./src/
COPY backend/artifacts/ ./artifacts/

RUN deno cache src/main.ts

ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD deno eval "const p = Deno.env.get('PORT') || '8000'; try { const r = await fetch('http://localhost:' + p + '/health'); Deno.exit(r.ok ? 0 : 1); } catch { Deno.exit(1); }"

CMD ["deno", "run", "-A", "src/main.ts"]
