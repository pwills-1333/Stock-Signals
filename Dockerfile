FROM denoland/deno:2.1.4

WORKDIR /app

# FORCE REBUILD
COPY force_rebuild.txt /app/force_rebuild.txt

# Copy everything from the repo root
COPY . .

# Ensure artifacts are copied correctly
COPY artifacts/ /app/artifacts/

# Ensure the public folder is copied correctly
COPY public/ /app/public/

# Cache dependencies
RUN deno cache src/main.ts || true

EXPOSE 8000

CMD ["deno", "run", "-A", "src/main.ts"]
