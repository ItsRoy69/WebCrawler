from __future__ import annotations

import asyncio
import logging
import time
import os
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4
from threading import Lock
from typing import Any
from collections import defaultdict

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

logger = logging.getLogger("webcrawler.api")

# ---------- Job store ----------
_jobs: dict[str, dict[str, Any]] = {}
_jobs_lock = Lock()

# Simple in-memory rate limit for auto-crawls (per IP)
_crawl_hits: dict[str, list[float]] = defaultdict(list)
_crawl_lock = Lock()
MAX_CRAWLS_PER_HOUR = 10


def _create_job(message: str) -> str:
    job_id = str(uuid4())
    with _jobs_lock:
        _jobs[job_id] = {
            "active": True,
            "progress": 0,
            "pages_found": 0,
            "pages_stored": 0,
            "message": message,
            "error": None,
        }
    return job_id


def _update_job(job_id: str, **kwargs) -> None:
    with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].update(kwargs)


def _get_job(job_id: str) -> dict[str, Any] | None:
    with _jobs_lock:
        return _jobs.get(job_id)


def _allow_crawl(ip: str) -> bool:
    now = time.time()
    with _crawl_lock:
        hits = [t for t in _crawl_hits[ip] if now - t < 3600]
        if len(hits) >= MAX_CRAWLS_PER_HOUR:
            _crawl_hits[ip] = hits
            return False
        hits.append(now)
        _crawl_hits[ip] = hits
        return True


_cache: SearchCache | None = None
_analytics: AnalyticsStore | None = None


def get_cache() -> SearchCache:
    global _cache
    if _cache is None:
        _cache = SearchCache(max_size=1000, ttl_hours=24)
    return _cache


def get_analytics(data_dir: Path) -> AnalyticsStore:
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

    static_dir = Path(__file__).parent / "static"
    dist_dir = static_dir / "dist"
    has_react = dist_dir.exists() and (dist_dir / "index.html").exists()

    if has_react:
        assets_dir = dist_dir / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # =========================================================
    # API ROUTES FIRST (must be registered before SPA catch-all)
    # =========================================================

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

    @app.get("/search")
    async def search(
        request: Request,
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
        job_id = None

        cache = get_cache()
        cached = cache.get(q, domain, limit, offset)
        if cached and not crawl:
            return {
                "query": q,
                "crawled": False,
                "cached": True,
                "job_id": None,
                "results": cached.get("results", []),
                "total": cached.get("total", 0),
            }

        if crawl and target:
            host = urlsplit(target).hostname
            client_ip = request.client.host if request.client else "unknown"
            if host and _allow_crawl(client_ip):
                job_id = _create_job(f"Crawling {host}...")
                background_tasks.add_task(
                    _crawl_site, target, host, data_dir, state, job_id
                )
                crawled = True
                logger.info("Started crawl job %s for %s (ip=%s)", job_id, host, client_ip)
            elif host:
                logger.warning("Crawl rate limit hit for ip=%s", client_ip)
                raise HTTPException(
                    429, "Too many crawl requests. Please try again later."
                )

        query = urlsplit(target).hostname if target else q
        try:
            results = engine().search(query, limit * 2, alpha, ef)

            if domain:
                results = [r for r in results if domain.lower() in r["url"].lower()]

            paginated = results[offset : offset + limit]
            total = len(results)

            response = {
                "query": q,
                "crawled": crawled,
                "cached": False,
                "job_id": job_id,
                "results": paginated,
                "total": total,
                "offset": offset,
                "limit": limit,
            }

            if not crawled:
                cache.set(q, response, domain, limit, offset)

            analytics = get_analytics(data_dir)
            analytics.log_search(
                SearchAnalytics(
                    query=q,
                    result_count=len(paginated),
                    response_time_ms=(time.time() - start_time) * 1000,
                    domain_filter=domain,
                )
            )
            return response
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Search failed")
            raise HTTPException(500, f"Search failed: {str(e)}")

    @app.get("/api/crawl-status")
    async def crawl_status(job_id: str | None = None):
        if job_id:
            job = _get_job(job_id)
            if not job:
                raise HTTPException(404, "Job not found")
            return {
                "job_id": job_id,
                "isCrawling": job["active"],
                "progress": job["progress"],
                "pagesFound": job["pages_found"],
                "pagesStored": job["pages_stored"],
                "message": job["message"],
                "error": job.get("error"),
            }

        with _jobs_lock:
            active = [(jid, j) for jid, j in _jobs.items() if j["active"]]
            if active:
                jid, j = active[-1]
                return {
                    "job_id": jid,
                    "isCrawling": True,
                    "progress": j["progress"],
                    "pagesFound": j["pages_found"],
                    "pagesStored": j["pages_stored"],
                    "message": j["message"],
                    "error": j.get("error"),
                }

        return {
            "job_id": None,
            "isCrawling": False,
            "progress": 0,
            "pagesFound": 0,
            "pagesStored": 0,
            "message": "",
            "error": None,
        }

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

    # =========================================================
    # FRONTEND ROUTES LAST
    # =========================================================

    @app.get("/", response_class=HTMLResponse)
    def home():
        if has_react:
            return FileResponse(dist_dir / "index.html")
        fallback = static_dir / "index.html"
        if fallback.exists():
            return FileResponse(fallback)
        raise HTTPException(
            404, "Frontend not found. Run: cd frontend && npm install && npm run build"
        )

    # SPA catch-all MUST be last so it does not swallow /health /stats /search
    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        # Never treat API-looking paths as SPA
        if full_path.startswith(("api/", "assets/")):
            raise HTTPException(404)
        if full_path in {"search", "stats", "health", "docs", "openapi.json"}:
            raise HTTPException(404)

        if has_react:
            return FileResponse(dist_dir / "index.html")
        fallback = static_dir / "index.html"
        if fallback.exists():
            return FileResponse(fallback)
        raise HTTPException(404)

    return app


async def _crawl_site(
    target: str,
    host: str,
    data_dir: Path,
    state: dict,
    job_id: str,
):
    try:
        logger.info("Crawl job %s starting for %s", job_id, target)
        _update_job(job_id, message=f"Crawling {host}...", progress=5)

        store = CorpusStore(data_dir)
        try:

            def progress_cb(pages_found: int, pages_stored: int, msg: str = ""):
                pct = min(90, int((pages_stored / 25) * 90)) if pages_stored else 5
                _update_job(
                    job_id,
                    pages_found=pages_found,
                    pages_stored=pages_stored,
                    progress=pct,
                    message=msg or f"Stored {pages_stored} pages...",
                )

            crawler = Crawler(
                store,
                [target],
                max_pages=25,
                delay=1.0,
                allowed_domains={host},
                use_sitemaps=True,
                progress_callback=progress_cb,
            )
            await crawler.crawl()
        finally:
            store.close()

        _update_job(job_id, message="Building index...", progress=95)
        await asyncio.to_thread(build_index, data_dir)
        state.pop("engine", None)
        # A crawl changes the corpus, so results from the previous index must
        # not survive in the in-memory search cache.
        get_cache().clear()

        _update_job(job_id, active=False, progress=100, message="Crawl complete")
        logger.info("Crawl job %s finished", job_id)
    except Exception as e:
        logger.exception("Crawl job %s failed", job_id)
        _update_job(
            job_id,
            active=False,
            error=str(e),
            message=f"Error: {e}",
        )


def run():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    data_dir = Path(os.getenv("DATA_DIR", "data"))
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(create_app(data_dir), host=host, port=port, log_level="info")
