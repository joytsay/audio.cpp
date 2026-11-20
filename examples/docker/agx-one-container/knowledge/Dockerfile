FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends imagemagick poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-tra && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=audiocpp-knowledge-npm,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts --prefer-offline
COPY server.mjs qa.mjs work-orders.mjs conversation.mjs scenarios.mjs scenario-files.mjs scenario-image.mjs scenario-simulation.mjs scenario-report.mjs rag-assets.mjs ./
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production PORT=8085 OCR_LANGUAGES=chi_tra+eng
USER node
EXPOSE 8085
CMD ["node", "server.mjs"]
