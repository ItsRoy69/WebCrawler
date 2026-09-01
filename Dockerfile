FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml README.md ./
COPY webcrawler ./webcrawler
RUN pip install --no-cache-dir .
ENV DATA_DIR=/data PORT=8000
VOLUME /data
EXPOSE 8000
CMD ["webcrawler-api"]
