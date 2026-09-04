from __future__ import annotations

import asyncio
import time
import os
from pathlib import Path
from urllib.parse import urlsplit

import uvicorn
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from .crawler import Crawler
from .indexer import build_index
from .search import HybridSearch
from .store import CorpusStore
from .urls import canonicalize
from .cache import SearchCache
from .analytics import AnalyticsStore, SearchAnalytics


# Global state for crawl progress and caching
crawl_state = {
    "active": False,
    "progress": 0,
    "pages_found": 0,
    "pages_stored": 0,
    "message": "",
}

# Global cache and analytics
_cache: SearchCache | None = None
_analytics: AnalyticsStore | None = None


def get_cache() -> SearchCache:
    """Get or create search cache"""
    global _cache
    if _cache is None:
        _cache = SearchCache(max_size=1000, ttl_hours=24)
    return _cache


def get_analytics(data_dir: Path) -> AnalyticsStore:
    """Get or create analytics store"""
    global _analytics
    if _analytics is None:
        _analytics = AnalyticsStore(data_dir)
    return _analytics


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

    # ---------- Frontend serving (Priority 0) ----------
    static_dir = Path(__file__).parent / "static"
    dist_dir = static_dir / "dist"
    has_react = dist_dir.exists() and (dist_dir / "index.html").exists()

    if has_react:
        # Serve Vite-built assets
        assets_dir = dist_dir / "assets"
        if assets_dir.exists():
            app.mount(
                "/assets",
                StaticFiles(directory=str(assets_dir)),
                name="assets",
            )

    @app.get("/", response_class=HTMLResponse)
    def home():
        """Serve React SPA or fallback HTML"""
        if has_react:
            return FileResponse(dist_dir / "index.html")
        # Fallback to old static HTML
        fallback = static_dir / "index.html"
        if fallback.exists():
            return FileResponse(fallback)
        raise HTTPException(
            404,
            "Frontend not found. Run: cd frontend && npm install && npm run build",
        )

    # SPA catch-all – any non-API path returns index.html so client routing works
    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        # Never intercept real API / docs / health routes
        blocked_prefixes = (
            "api/",
            "search",
            "stats",
            "health",
            "docs",
            "openapi.json",
            "assets/",
        )
        if full_path.startswith(blocked_prefixes) or full_path in {
            "search",
            "stats",
            "health",
        }:
            raise HTTPException(404, "Not found")

        if has_react:
            return FileResponse(dist_dir / "index.html")

        fallback = static_dir / "index.html"
        if fallback.exists():
            return FileResponse(fallback)
        raise HTTPException(404, "Frontend not found")

    # ---------- Search endpoint ----------
    @app.get("/search")
    async def search(
        q: str = Query(min_length=1),
        limit: int = Query(10, ge=1, le=100),
        offset: int = Query(0, ge=0),
        alpha: float = Query(0.5, ge=0, le=1),
        ef: int = Query(100, ge=10, le=1000),
        domain: str | None = Query(None),
        crawl: bool = True,
        background_tasks: BackgroundTasks = BackgroundTasks(),
    ):
        start_time = time.time()
        target = canonicalize(q.strip())
        crawled = False

        cache = get_cache()
        cached_result = cache.get(q, domain, limit, offset)

        if cached_result and not crawl:
            analytics = get_analytics(data_dir)
            analytics.log_search(
                SearchAnalytics(
                    query=q,
                    result_count=len(cached_result.get("results", [])),
                    response_time_ms=(time.time() - start_time) * 1000,
                    domain_filter=domain,
                )
            )
            return {
                "query": q,
                "crawled": False,
                "cached": True,
                "results": cached_result.get("results", []),
                "total": cached_result.get("total", 0),
            }

        if crawl and target:
            host = urlsplit(target).hostname
            if host:
                crawl_state["active"] = True
                crawl_state["progress"] = 0
                crawl_state["pages_found"] = 0
                crawl_state["pages_stored"] = 0
                crawl_state["message"] = f"Crawling {host}..."
                background_tasks.add_task(_crawl_site, target, host, data_dir, state)
                crawled = True

        query = urlsplit(target).hostname if target else q
        try:
            results = engine().search(query, limit * 2, alpha, ef)

            if domain:
                results = [
                    r for r in results if domain.lower() in r["url"].lower()
                ]

            paginated_results = results[offset : offset + limit]
            total_available = len(results)

            response = {
                "query": q,
                "crawled": crawled,
                "cached": False,
                "results": paginated_results,
                "total": total_available,
                "offset": offset,
                "limit": limit,
            }

            cache.set(q, response, domain, limit, offset)

            analytics = get_analytics(data_dir)
            analytics.log_search(
                SearchAnalytics(
                    query=q,
                    result_count=len(paginated_results),
                    response_time_ms=(time.time() - start_time) * 1000,
                    domain_filter=domain,
                )
            )

            return response
        except Exception as e:
            raise HTTPException(500, f"Search failed: {str(e)}")

    @app.get("/api/crawl-status")
    async def crawl_status():
        return {
            "isCrawling": crawl_state["active"],
            "progress": crawl_state["progress"],
            "pagesFound": crawl_state["pages_found"],
            "pagesStored": crawl_state["pages_stored"],
            "message": crawl_state["message"],
        }

    @app.get("/stats")
    def stats():
        try:
            e = engine()
            store = CorpusStore(data_dir)
            doc_stats = store.document_stats()
            store.close()

            return {
                "documents": len(e.documents),
                "embedding_model": e.manifest.get("embedding_model", "hashing-v1"),
                "index_size_mb": e.manifest.get("index_size_mb"),
                **doc_stats,
            }
        except Exception as e:
            raise HTTPException(503, f"Stats unavailable: {str(e)}")

    @app.get("/api/analytics")
    def get_analytics_data():
        try:
            analytics = get_analytics(data_dir)
            return {
                "search_stats": analytics.get_search_stats(),
                "recent_queries": analytics.get_recent_queries(limit=20),
                "top_queries": analytics.get_top_queries(limit=10),
            }
        except Exception as e:
            raise HTTPException(500, f"Analytics unavailable: {str(e)}")

    @app.get("/api/cache-status")
    def cache_status():
        cache = get_cache()
        return {"cache_size": cache.size(), "max_size": cache.max_size}

    @app.post("/api/cache-clear")
    def cache_clear():
        cache = get_cache()
        cache.clear()
        return {"status": "ok", "message": "Cache cleared"}

    @app.get("/health")
    def health():
        try:
            engine()
            return {"status": "ok", "frontend": "react" if has_react else "fallback"}
        except Exception:
            return {
                "status": "degraded",
                "message": "Index not ready",
                "frontend": "react" if has_react else "fallback",
            }

    return app


async def _crawl_site(target: str, host: str, data_dir: Path, state: dict):
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
                use_sitemaps=True,
            )
            await crawler.crawl()
            crawl_state["pages_stored"] = store.document_count()

            analytics = get_analytics(data_dir)
            analytics.log_crawl_metrics(crawler.metrics, host)
        finally:
            store.close()

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
    data_dir = Path(os.getenv("DATA_DIR", "data"))
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")

    uvicorn.run(
        create_app(data_dir),
        host=host,
        port=port,
        log_level="info",
    )