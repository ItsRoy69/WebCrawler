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

### 2. Configure authentication (optional but recommended)

Sign-in, Google/GitHub OAuth, and per-user storage run on Supabase. See
**[docs/supabase.md](docs/supabase.md)** for the full walkthrough.

Short version:

```bash
cp .env.example .env              # backend: add SUPABASE_SERVICE_ROLE_KEY
cp frontend/.env.example frontend/.env
```

Then run the SQL in `supabase/migrations/` once from the Supabase SQL Editor.

The app runs fine without it — search and crawling are unaffected — but
`/health` will report `auth.configured: false`.

### 3. Build the frontend (one-time)

```bash
cd frontend
npm install
npm run build
cd ..
```

> This produces `webcrawler/static/dist/`. After the first build you can commit the `dist` folder so other people don’t need Node.

### 4. Crawl → Index → Serve

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

The frontend keys are compiled in at build time, so pass them as build args:

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=sb_publishable_... \
  -t webcrawler .

docker run -p 8000:8000 -v $(pwd)/data:/data \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_ANON_KEY=sb_publishable_... \
  -e SUPABASE_SERVICE_ROLE_KEY=sb_secret_... \
  webcrawler
```

---

## Project structure

```
WebCrawler/
├── webcrawler/          # Python package (crawler, index, API)
│   ├── supabase.py      # Config, JWKS token verification, PostgREST access
│   ├── auth.py          # /api/auth and /api/me routes
│   └── static/dist/     # Built React frontend (after npm run build)
├── frontend/            # React + TypeScript + Tailwind source
│   └── src/lib/         # supabase.ts (client) and auth.ts (sign-in, API keys)
├── supabase/migrations/ # SQL to run once in the Supabase SQL Editor
├── docs/
│   ├── design.md        # Architecture & design decisions
│   └── supabase.md      # Auth, Google/GitHub OAuth, and storage setup
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
- Passwords are owned by Supabase Auth (bcrypt) and never reach this app.
  The API only ever sees a signed JWT, verified against Supabase's JWKS.
- Per-user tables are protected by row level security, so a stolen publishable
  key still only exposes the attacker's own rows.

See [docs/design.md](docs/design.md) for deeper architecture notes.

---

## API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | React search UI |
| `GET /search?q=...` | Hybrid search |
| `GET /stats` | Corpus & index stats |
| `GET /api/crawl-status` | Live crawl progress |
| `GET /health` | Health check (includes auth configuration) |
| `GET /api/auth/config` | Whether Supabase is configured and which providers exist |
| `GET /api/me` | Current profile (requires `Authorization: Bearer <token>`) |
| `PATCH /api/me` | Update display name |
| `GET/POST/DELETE /api/me/history` | Per-user search history |
| `GET/POST /api/me/crawls` | Per-user crawl runs |
| `GET/POST/DELETE /api/me/api-keys` | Developer keys (hashed at rest) |
| `GET/POST/DELETE /api/me/credentials` | Encrypted third-party secrets |
| `GET /api/docs` | Swagger UI |

Authenticated routes accept either a Supabase access token (`Authorization:
Bearer …`) or a developer key (`X-API-Key: wck_…`).

---

## Requirements

- Python ≥ 3.11
- Node.js ≥ 18 (only needed to build the frontend once)
