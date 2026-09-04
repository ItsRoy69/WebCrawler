# ---------- Stage 1: Build React frontend ----------
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Python runtime ----------
FROM python:3.12-slim
WORKDIR /app

COPY pyproject.toml README.md ./
COPY webcrawler ./webcrawler

# Copy the built frontend from stage 1
COPY --from=frontend-builder /app/webcrawler/static/dist ./webcrawler/static/dist

RUN pip install --no-cache-dir .

ENV DATA_DIR=/data PORT=8000
VOLUME /data
EXPOSE 8000

CMD ["webcrawler-api"]