from __future__ import annotations
import asyncio, os
from pathlib import Path
from urllib.parse import urlsplit
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from .crawler import Crawler
from .indexer import build_index
from .search import HybridSearch
from .store import CorpusStore
from .urls import canonicalize

def create_app(data_dir: Path = Path("data")) -> FastAPI:
    app = FastAPI(title="WebCrawler Hybrid Search", version="0.1.0")
    state: dict[str, HybridSearch] = {}
    def engine() -> HybridSearch:
        if "engine" not in state:
            try: state["engine"] = HybridSearch(data_dir)
            except FileNotFoundError as e: raise HTTPException(503, "Index unavailable. Run build-index first.") from e
        return state["engine"]
    @app.get("/")
    def home(): return FileResponse(Path(__file__).parent / "static" / "index.html")
    @app.get("/search")
    def search(q: str = Query(min_length=1), limit: int = Query(10, ge=1, le=100), alpha: float = Query(.5, ge=0, le=1), ef: int = Query(100, ge=10, le=1000), crawl: bool = True):
        target = canonicalize(q.strip()); crawled = False
        if crawl and target:
            host = urlsplit(target).hostname
            print(f"[crawl] starting {target} (max 25 pages)", flush=True)
            store = CorpusStore(data_dir)
            try: asyncio.run(Crawler(store, [target], max_pages=25, delay=1.0, allowed_domains={host}).crawl())
            finally: store.close()
            build_index(data_dir); state.pop("engine", None); crawled = True
            print(f"[crawl] finished {target}", flush=True)
        query = urlsplit(target).hostname if target else q
        return {"query": q, "crawled": crawled, "results": engine().search(query, limit, alpha, ef)}
    @app.get("/stats")
    def stats():
        e = engine(); return {"documents": len(e.documents), **e.manifest}
    return app

def run(): uvicorn.run(create_app(Path(os.getenv("DATA_DIR", "data"))), host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
