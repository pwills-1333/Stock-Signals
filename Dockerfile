FROM denoland/deno:2.1.4

WORKDIR /app

# Copy everything first
COPY . .

# Cache (with fallback so the build doesn't fail)
RUN deno cache src/main.ts || true

EXPOSE 8000

CMD ["deno", "run", "-A", "src/main.ts"]
