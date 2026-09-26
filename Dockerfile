# ---------- Stage 1: Build React frontend ----------
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Vite inlines VITE_* at build time. Pass the publishable key, never the secret.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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

# The rest of the Supabase config is supplied at runtime with -e. Without
# SUPABASE_URL the app still runs; sign-in is disabled and /health reports
# auth.configured = false.
CMD ["webcrawler-api"]
