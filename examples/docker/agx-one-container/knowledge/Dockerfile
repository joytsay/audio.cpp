FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-tra && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server.mjs qa.mjs work-orders.mjs conversation.mjs ./
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production PORT=8085 KNOWLEDGE_ROOT=/files OCR_LANGUAGES=chi_tra+eng
USER node
EXPOSE 8085
CMD ["node", "server.mjs"]
