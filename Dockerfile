FROM denoland/deno:2.1.4

WORKDIR /app

# Copy everything
COPY . .

# Cache dependencies (optional but good)
RUN deno cache src/main.ts || true

# Railway will inject PORT automatically
EXPOSE 8000

# Correct start command
CMD ["deno", "run", "-A", "src/main.ts"]
