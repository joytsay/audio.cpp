FROM qdrant/qdrant:v1.16.3 AS qdrant
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends imagemagick libunwind8 poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-tra && rm -rf /var/lib/apt/lists/*
COPY --from=qdrant /qdrant/qdrant /qdrant/qdrant.spdx.json /qdrant/
COPY --from=qdrant /qdrant/config/ /qdrant/config/
COPY --from=qdrant /qdrant/static/ /qdrant/static/
RUN /qdrant/qdrant --version
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=audiocpp-knowledge-npm,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts --prefer-offline
COPY start.mjs server.mjs ivr-engine.mjs replay-scenarios.mjs test.mjs qa.mjs scenarios.mjs scenario-files.mjs scenario-image.mjs rag-assets.mjs rag-embeddings.mjs ./
RUN mkdir -p /data /qdrant/storage /qdrant/snapshots && chown node:node /data /qdrant/storage /qdrant/snapshots
ENV NODE_ENV=production PORT=8085 OCR_LANGUAGES=chi_tra+eng
EXPOSE 8085 6333
CMD ["node", "start.mjs"]
