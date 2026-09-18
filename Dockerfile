FROM denoland/deno:2.1.4

WORKDIR /app

# Copy backend code from the correct folder
COPY Stock-Signals/ .

# Copy artifacts
COPY Stock-Signals/artifacts/ /app/artifacts/

RUN deno cache src/main.ts || true

EXPOSE 8000

CMD ["deno", "run", "-A", "src/main.ts"]
