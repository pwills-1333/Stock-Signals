FROM denoland/deno:2.1.4

WORKDIR /app

COPY . .

COPY artifacts/ /app/artifacts/
COPY public/ /app/public/

RUN deno cache src/main.ts || true

EXPOSE 8000

CMD ["deno", "run", "-A", "src/main.ts"]
