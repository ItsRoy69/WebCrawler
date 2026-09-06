"""API route tests – protect against SPA catch-all swallowing real endpoints."""

from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from fastapi.testclient import TestClient

from webcrawler.api import create_app
from webcrawler.jobs import CrawlJobStore


@pytest.fixture
def client():
    with TemporaryDirectory() as tmp:
        app = create_app(Path(tmp))
        with TestClient(app) as c:
            yield c


def test_health_not_swallowed_by_spa(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert "status" in data
    assert data["status"] in {"ok", "degraded"}


def test_stats_not_404(client):
    """Should be 200 or 503 (no index), never 404 from SPA catch-all."""
    r = client.get("/stats")
    assert r.status_code in {200, 503}
    assert r.status_code != 404


def test_search_requires_query(client):
    r = client.get("/search")
    assert r.status_code == 422  # missing q


def test_crawl_status_empty(client):
    r = client.get("/api/crawl-status")
    assert r.status_code == 200
    data = r.json()
    assert data["isCrawling"] is False


def test_search_does_not_start_a_crawl_by_default(client):
    """A URL search must not enqueue network work unless crawl=true is explicit."""
    response = client.get("/search", params={"q": "https://example.com"})
    # The test fixture deliberately has no index, but no crawl job is created.
    assert response.status_code == 503
    assert client.get("/api/crawl-status").json()["isCrawling"] is False


def test_crawl_job_store_persists_between_instances(tmp_path):
    first = CrawlJobStore(tmp_path)
    first.create("job-1", "https://example.com", "example.com", "Starting crawl")
    first.update("job-1", status="running", progress=42, pages_found=8, pages_stored=4)

    second = CrawlJobStore(tmp_path)
    job = second.get("job-1")
    assert job is not None
    # A restart returns in-flight work to the durable queue for the worker.
    assert job["status"] == "queued"
    assert "resume" in job["message"].lower()
    assert job["progress"] == 42


def test_home_serves_something(client):
    r = client.get("/")
    # 200 with HTML, or 404 if frontend not built – but not a crash
    assert r.status_code in {200, 404}
