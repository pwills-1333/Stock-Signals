FROM denoland/deno:2.1.4

WORKDIR /app

COPY . .

COPY artifacts/ /app/artifacts/
COPY public/ /app/public/

RUN deno cache src/main.ts || true

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["deno", "run", "-A", "src/main.ts"]
