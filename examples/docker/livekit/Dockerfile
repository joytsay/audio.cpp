FROM node:22-bookworm-slim AS web-build
WORKDIR /web
RUN npm install --save-exact livekit-client@2.15.6 esbuild@0.25.5
COPY client.js .
RUN ./node_modules/.bin/esbuild client.js --bundle --format=esm --outfile=bundle.js

FROM python:3.11-slim-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY agent.py adapter.py web.py settings.py index.html entrypoint.sh ./
COPY --from=web-build /web/bundle.js /app/client.js
RUN python agent.py download-files
ENTRYPOINT ["bash", "/app/entrypoint.sh"]
