FROM denoland/deno:2.1.4

WORKDIR /app

COPY deno.json .
RUN deno cache src/main.ts || true

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["deno", "run", "-A", "--env", "src/main.ts"]
