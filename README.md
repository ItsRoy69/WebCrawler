# WebCrawler

A self-contained hybrid search engine. It crawls only explicit seed sites, persists every frontier decision, honors `robots.txt`, rate-limits each origin, deduplicates documents, builds BM25 and embeddings, and searches them with a custom HNSW index.

## Quick start

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e .
webcrawler crawl --seed https://example.org --max-pages 100 --data-dir data
webcrawler build-index --data-dir data
webcrawler serve --data-dir data
```

If Git Bash reports `webcrawler: command not found` on Windows, use the shell-independent form:

```bash
python -m webcrawler crawl --seed https://example.org --max-pages 100 --data-dir data
```

To enable the short command, add your Python user Scripts directory to Git Bash’s PATH (the installer prints the exact directory):

```bash
export PATH="$PATH:$(python -c 'import site; print(site.USER_BASE)')/Scripts"
```

Raw HTML is gzip-compressed under `data/raw/`; extracted text and crawl metadata live in `data/corpus.sqlite3`. Re-running the command resumes its URL frontier.

## Common Crawl

Download a specific WARC shard and ingest it into the same corpus:

```powershell
webcrawler ingest-warc --url https://data.commoncrawl.org/crawl-data/CC-MAIN-2025-30/segments/.../warc/CC-MAIN-....warc.gz --data-dir data --max-records 100000
```

The source URL is recorded for each document. Choose a shard deliberately: WARC files are commonly multiple gigabytes. This does not add discovered links to the crawler frontier.

## Design boundaries

- No open-web traversal: allowed origins are exactly the origins of supplied seeds unless `--allow-domain` is given.
- `robots.txt` is fetched and checked before each crawl request; failures are treated as disallow (safe default).
- URL canonicalization drops fragments and tracking parameters, normalizes host/scheme, and preserves meaningful query parameters.
- Content identity is SHA-256 of normalized extracted text, so mirrors/duplicate pages are stored once.

## Retrieval and serving

`build-index` generates `data/index/bm25.json`, `vectors.npy`, and `hnsw.npz`. The default embedder is a deterministic feature-hashing encoder: it keeps the system portable and has no model download, but it is not a replacement for a trained semantic model. Supply `--embedding-model sentence-transformers/all-MiniLM-L6-v2` after installing `sentence-transformers` to make real transformer embeddings; the index remains custom either way.

`serve` exposes `GET /search?q=...`, `GET /stats`, and a small browser UI at `/`. See [docs/design.md](docs/design.md) for design choices, benchmark procedure, and the 1B-vector scaling model.

Entering an `http(s)` URL in the UI automatically crawls that origin (maximum 25 pages, with robots and a one-second per-origin delay), rebuilds the index, and displays its results. Add `&crawl=false` to an API request when you want a strictly index-only search.
