FROM denoland/deno:2.1.4

WORKDIR /app

COPY deno.json .
COPY src/ ./src/
COPY artifacts/ ./artifacts/

RUN deno cache src/main.ts

# Railway injects PORT; default to 8000 for local Docker
ENV PORT=8000

EXPOSE 8000

# Healthcheck uses $PORT so it works on Railway and locally
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD deno eval "const p = Deno.env.get('PORT') || '8000'; try { const r = await fetch('http://localhost:' + p + '/health'); Deno.exit(r.ok ? 0 : 1); } catch { Deno.exit(1); }"

CMD ["deno", "run", "-A", "src/main.ts"]
