import httpx
import pytest

from webcrawler.crawler import Crawler
from webcrawler.store import CorpusStore


@pytest.mark.asyncio
async def test_transient_server_failure_is_retried(tmp_path, monkeypatch):
    attempts = 0

    async def no_sleep(_: float) -> None:
        return None

    def responder(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(503 if attempts < 3 else 200, request=request)

    monkeypatch.setattr("webcrawler.crawler.asyncio.sleep", no_sleep)
    store = CorpusStore(tmp_path)
    crawler = Crawler(store, ["https://example.com"], max_pages=1, delay=0)
    try:
        async with httpx.AsyncClient(transport=httpx.MockTransport(responder)) as client:
            response = await crawler.fetch_with_retries(client, "https://example.com")
        assert response.status_code == 200
        assert attempts == 3
    finally:
        store.close()
