FROM denoland/deno:2.1.4

WORKDIR /app

COPY deno.json .
COPY src/ ./src/
COPY artifacts/ ./artifacts/

# Persist predictions + learning state here (mount a volume in production)
RUN mkdir -p /app/data

RUN deno cache src/main.ts

ENV PORT=8000
ENV DATA_DIR=/app/data
EXPOSE 8000

# Optional learning feedback (ms). 86400000 = daily. 0 = off.
# ENV RESOLVE_DUE_INTERVAL_MS=86400000
# ENV RESOLVE_DUE_LIMIT=20
# ENV RESOLVE_SECRET=change-me

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD deno eval "const p = Deno.env.get('PORT') || '8000'; try { const r = await fetch('http://localhost:' + p + '/health'); Deno.exit(r.ok ? 0 : 1); } catch { Deno.exit(1); }"

CMD ["deno", "run", "-A", "src/main.ts"]

# Railway / Docker Compose: mount a volume at /app/data
#   volumes:
#     - stock_signals_data:/app/data
