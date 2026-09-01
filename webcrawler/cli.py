from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from .crawler import Crawler
from .indexer import build_index
from .store import CorpusStore
from .warc import ingest_warc


def main() -> None:
    parser = argparse.ArgumentParser(prog="webcrawler")
    sub = parser.add_subparsers(dest="command", required=True)
    crawl = sub.add_parser("crawl", help="crawl explicit seed sites")
    crawl.add_argument("--seed", action="append", required=True)
    crawl.add_argument("--max-pages", type=int, default=100)
    crawl.add_argument("--delay", type=float, default=1.0, help="minimum seconds between requests per origin")
    crawl.add_argument("--allow-domain", action="append", default=[])
    crawl.add_argument("--data-dir", type=Path, default=Path("data"))
    warc = sub.add_parser("ingest-warc", help="ingest a Common Crawl WARC shard")
    warc.add_argument("--url", required=True)
    warc.add_argument("--max-records", type=int)
    warc.add_argument("--data-dir", type=Path, default=Path("data"))
    build = sub.add_parser("build-index", help="build BM25, embeddings, and custom HNSW")
    build.add_argument("--data-dir", type=Path, default=Path("data"))
    build.add_argument("--embedding-model")
    build.add_argument("--batch-size", type=int, default=128)
    build.add_argument("--m", type=int, default=16)
    build.add_argument("--ef-construction", type=int, default=200)
    serve = sub.add_parser("serve", help="serve hybrid-search API and UI")
    serve.add_argument("--data-dir", type=Path, default=Path("data"))
    serve.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    args.data_dir.mkdir(parents=True, exist_ok=True)
    if args.command == "build-index":
        print(build_index(args.data_dir, args.embedding_model, args.batch_size, args.m, args.ef_construction))
        return
    if args.command == "serve":
        import uvicorn
        from .api import create_app
        uvicorn.run(create_app(args.data_dir), host="0.0.0.0", port=args.port)
        return
    store = CorpusStore(args.data_dir)
    try:
        if args.command == "crawl":
            allowed = set(args.allow_domain) or None
            print(f"stored {asyncio.run(Crawler(store, args.seed, max_pages=args.max_pages, delay=args.delay, allowed_domains=allowed).crawl())} documents")
        else:
            print(f"stored {ingest_warc(store, args.url, args.max_records)} documents")
    finally:
        store.close()


if __name__ == "__main__":
    main()
