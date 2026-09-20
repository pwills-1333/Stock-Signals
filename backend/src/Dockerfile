FROM denoland/deno:2.1.4

WORKDIR /app

COPY src/ /app/src/
COPY artifacts/ /app/artifacts/

RUN deno cache src/main.ts || true

HEALTHCHECK CMD ["deno", "eval", "try{const r=await fetch('http://localhost:8000/health');Deno.exit(r.ok?0:1);}catch{Deno.exit(1);}"]

EXPOSE 8000

CMD ["deno", "run", "-A", "src/main.ts"]
