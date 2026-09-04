# WebCrawler

A self-contained hybrid search engine.  
It crawls only the sites you give it, stores pages in SQLite + gzipped HTML, builds BM25 + embeddings + a custom HNSW index, and serves a modern React search UI.

## Quick Start (Recommended)

### 1. Clone & install

```bash
git clone https://github.com/ItsRoy69/WebCrawler.git
cd WebCrawler

python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -e .
```

### 2. Build the frontend (one-time)

```bash
cd frontend
npm install
npm run build
cd ..
```

> This produces `webcrawler/static/dist/`. After the first build you can commit the `dist` folder so other people don’t need Node.

### 3. Crawl → Index → Serve

```bash
# Crawl a site (example)
webcrawler crawl --seed https://example.org --max-pages 50 --data-dir data

# Build the search index
webcrawler build-index --data-dir data

# Start the server
webcrawler serve --data-dir data
```

Open **http://localhost:8000**

You should see the modern React UI.

---

## Development mode (hot reload)

**Terminal 1 – Backend**
```bash
webcrawler serve --data-dir data
```

**Terminal 2 – Frontend**
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** (Vite proxies API calls to port 8000).

---

## Common commands

| Command | Purpose |
|---------|---------|
| `webcrawler crawl --seed URL --max-pages N` | Crawl a site |
| `webcrawler build-index` | Build BM25 + embeddings + HNSW |
| `webcrawler serve` | Start API + UI |
| `webcrawler ingest-warc --url <warc-url>` | Ingest a Common Crawl WARC |

Useful flags:
- `--data-dir data` (default)
- `--delay 1.0` (politeness)
- `--allow-domain example.com`
- `--embedding-model sentence-transformers/all-MiniLM-L6-v2` (real embeddings)

---

## Docker

```bash
docker build -t webcrawler .
docker run -p 8000:8000 -v $(pwd)/data:/data webcrawler
```

---

## Project structure

```
WebCrawler/
├── webcrawler/          # Python package (crawler, index, API)
│   └── static/dist/     # Built React frontend (after npm run build)
├── frontend/            # React + TypeScript + Tailwind source
├── docs/
│   └── design.md        # Architecture & design decisions
├── tests/
├── scripts/
└── pyproject.toml
```

---

## Design boundaries

- Only crawls origins you explicitly seed (or allow with `--allow-domain`)
- Honours `robots.txt` (fail-closed)
- Rate-limits per origin
- Deduplicates by content hash
- Default embedder is portable feature hashing (no model download).  
  Install `sentence-transformers` and pass `--embedding-model` for real semantic search.

See [docs/design.md](docs/design.md) for deeper architecture notes.

---

## API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | React search UI |
| `GET /search?q=...` | Hybrid search |
| `GET /stats` | Corpus & index stats |
| `GET /api/crawl-status` | Live crawl progress |
| `GET /health` | Health check |
| `GET /api/docs` | Swagger UI |

---

## Requirements

- Python ≥ 3.11
- Node.js ≥ 18 (only needed to build the frontend once)
