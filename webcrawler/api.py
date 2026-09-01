from __future__ import annotations
import asyncio
import os
from pathlib import Path
from urllib.parse import urlsplit
from datetime import datetime

import uvicorn
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .crawler import Crawler
from .indexer import build_index
from .search import HybridSearch
from .store import CorpusStore
from .urls import canonicalize


# Global state for crawl progress
crawl_state = {"active": False, "progress": 0, "pages_found": 0, "pages_stored": 0, "message": ""}


def create_app(data_dir: Path = Path("data")) -> FastAPI:
    app = FastAPI(
        title="WebCrawler Hybrid Search",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    state: dict[str, HybridSearch] = {}

    def engine() -> HybridSearch:
        if "engine" not in state:
            try:
                state["engine"] = HybridSearch(data_dir)
            except FileNotFoundError as e:
                raise HTTPException(
                    503, "Index unavailable. Run 'webcrawler build-index' first."
                ) from e
        return state["engine"]

    # Serve built React frontend if available, otherwise fallback to old HTML
    static_dir = Path(__file__).parent / "static"
    dist_dir = static_dir / "dist"

    if dist_dir.exists():
        app.mount("/assets", StaticFiles(directory=dist_dir / "assets", check_dir=False), name="assets")

    # Homepage - serve SPA
    @app.get("/", response_class=FileResponse)
    def home():
        index_path = dist_dir / "index.html" if dist_dir.exists() else static_dir / "index.html"
        if not index_path.exists():
            raise HTTPException(404, "Frontend not found. Run: npm run build in frontend/")
        return str(index_path)

    # Search endpoint
    @app.get("/search")
    async def search(
        q: str = Query(min_length=1),
        limit: int = Query(10, ge=1, le=100),
        alpha: float = Query(0.5, ge=0, le=1),
        ef: int = Query(100, ge=10, le=1000),
        crawl: bool = True,
        background_tasks: BackgroundTasks = BackgroundTasks(),
    ):
        """
        Hybrid search endpoint combining BM25 + embeddings.
        If query is a URL, automatically crawls that site (up to 25 pages).
        """
        target = canonicalize(q.strip())
        crawled = False

        # If query is a URL and crawl=true, spawn background crawl
        if crawl and target:
            host = urlsplit(target).hostname
            if host:
                crawl_state["active"] = True
                crawl_state["progress"] = 0
                crawl_state["pages_found"] = 0
                crawl_state["pages_stored"] = 0
                crawl_state["message"] = f"Crawling {host}..."
                background_tasks.add_task(
                    _crawl_site, target, host, data_dir, state
                )
                crawled = True

        # Search index with hostname or query text
        query = urlsplit(target).hostname if target else q
        try:
            results = engine().search(query, limit, alpha, ef)
            return {
                "query": q,
                "crawled": crawled,
                "results": results,
            }
        except Exception as e:
            raise HTTPException(500, f"Search failed: {str(e)}")

    # Crawl status endpoint
    @app.get("/api/crawl-status")
    async def crawl_status():
        """Poll crawl progress"""
        return {
            "isCrawling": crawl_state["active"],
            "progress": crawl_state["progress"],
            "pagesFound": crawl_state["pages_found"],
            "pagesStored": crawl_state["pages_stored"],
            "message": crawl_state["message"],
        }

    # Statistics endpoint
    @app.get("/stats")
    def stats():
        """Index and corpus statistics"""
        try:
            e = engine()
            return {
                "documents": len(e.documents),
                "embedding_model": e.manifest.get("embedding_model", "hashing-v1"),
                "index_size_mb": e.manifest.get("index_size_mb"),
            }
        except Exception as e:
            raise HTTPException(503, f"Stats unavailable: {str(e)}")

    # Health check
    @app.get("/health")
    def health():
        """Health check endpoint"""
        try:
            engine()
            return {"status": "ok"}
        except Exception:
            return {"status": "degraded", "message": "Index not ready"}

    return app


async def _crawl_site(target: str, host: str, data_dir: Path, state: dict):
    """Background crawl task"""
    try:
        print(f"[crawl] starting {target} (max 25 pages)", flush=True)
        store = CorpusStore(data_dir)
        try:
            crawler = Crawler(
                store,
                [target],
                max_pages=25,
                delay=1.0,
                allowed_domains={host},
            )
            # TODO: Add progress callback to crawler for real-time updates
            await crawler.crawl()
            crawl_state["pages_stored"] = store.document_count()
        finally:
            store.close()

        # Rebuild index
        crawl_state["message"] = "Building index..."
        build_index(data_dir)
        state.pop("engine", None)

        print(f"[crawl] finished {target}", flush=True)
    except Exception as e:
        crawl_state["message"] = f"Error: {str(e)}"
        print(f"[crawl] error: {e}", flush=True)
    finally:
        crawl_state["active"] = False


def run():
    """Run the API server"""
    data_dir = Path(os.getenv("DATA_DIR", "data"))
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    
    uvicorn.run(
        create_app(data_dir),
        host=host,
        port=port,
        log_level="info",
    )
