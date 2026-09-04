"""API route tests – protect against SPA catch-all swallowing real endpoints."""

from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from fastapi.testclient import TestClient

from webcrawler.api import create_app


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


def test_home_serves_something(client):
    r = client.get("/")
    # 200 with HTML, or 404 if frontend not built – but not a crash
    assert r.status_code in {200, 404}