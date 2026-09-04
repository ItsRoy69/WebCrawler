"""Integration tests for WebCrawler"""

from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from webcrawler.store import CorpusStore
from webcrawler.extract import extract_html, text_hash
from webcrawler.cache import SearchCache
from webcrawler.analytics import AnalyticsStore, SearchAnalytics
from webcrawler.urls import canonicalize


class TestCorpusStore:
    def test_store_document(self):
        with TemporaryDirectory() as tmpdir:
            store = CorpusStore(Path(tmpdir))

            assert store.enqueue("https://example.com/page1")
            assert not store.enqueue("https://example.com/page1")  # duplicate

            url = store.next_url()
            assert url == "https://example.com/page1"

            inserted = store.save_document(
                url="https://example.com/page1",
                title="Test Page",
                text="This is test content.",
                html=b"<html><body>Test</body></html>",
                source="crawl",
                http_status=200,
                content_type="text/html",
            )
            assert inserted is True

            # Same content hash → should not insert
            inserted = store.save_document(
                url="https://example.com/page2",
                title="Test Page",
                text="This is test content.",
                html=b"<html><body>Test</body></html>",
                source="crawl",
                http_status=200,
                content_type="text/html",
            )
            assert inserted is False

            store.mark("https://example.com/page1", "stored")
            assert store.document_count() == 1
            store.close()

    def test_metadata_persistence(self):
        with TemporaryDirectory() as tmpdir:
            store = CorpusStore(Path(tmpdir))

            store.save_document(
                url="https://example.com/page",
                title="Article Title",
                text="Article content",
                html=b"<html></html>",
                source="crawl",
                http_status=200,
                content_type="text/html",
                author="John Doe",
                publish_date="2026-01-15T10:00:00Z",
                description="Short description",
                image_url="https://example.com/image.jpg",
            )

            docs = store.get_documents_by_source("crawl")
            assert len(docs) == 1
            assert docs[0]["author"] == "John Doe"
            assert docs[0]["publish_date"] == "2026-01-15T10:00:00Z"
            store.close()

    def test_frontier_summary(self):
        with TemporaryDirectory() as tmpdir:
            store = CorpusStore(Path(tmpdir))
            store.enqueue("https://example.com/a")
            store.enqueue("https://example.com/b")
            store.mark("https://example.com/a", "stored")

            summary = store.frontier_summary()
            assert summary.get("queued") == 1
            assert summary.get("stored") == 1
            store.close()


class TestExtraction:
    def test_extract_basic_content(self):
        html = """
        <html>
            <head><title>Test Page</title></head>
            <body>
                <p>This is test content.</p>
                <a href="/page2">Link</a>
            </body>
        </html>
        """
        page = extract_html(html, "https://example.com/")
        assert page.title == "Test Page"
        assert "test content" in page.text.lower()
        assert len(page.links) > 0

    def test_extract_metadata(self):
        html = """
        <html>
            <head>
                <title>Article</title>
                <meta name="author" content="Jane Doe">
                <meta name="description" content="Article description">
                <meta property="article:published_time" content="2026-01-15T10:00:00Z">
                <meta property="og:image" content="https://example.com/image.jpg">
            </head>
            <body>Content</body>
        </html>
        """
        page = extract_html(html, "https://example.com/")
        assert page.author == "Jane Doe"
        assert page.description == "Article description"
        assert page.publish_date == "2026-01-15T10:00:00Z"
        assert page.image_url == "https://example.com/image.jpg"

    def test_text_hash_deterministic(self):
        text = "This is test content"
        assert text_hash(text) == text_hash(text)
        assert text_hash(text) == text_hash("  This  is  test  content  ")


class TestCache:
    def test_cache_basic(self):
        cache = SearchCache(max_size=10, ttl_hours=1)
        results = {"results": []}
        cache.set("test query", results)
        assert cache.get("test query") == results

    def test_cache_lru_eviction(self):
        cache = SearchCache(max_size=2)
        cache.set("query1", {"results": [1]})
        cache.set("query2", {"results": [2]})
        cache.set("query3", {"results": [3]})  # should evict query1
        assert cache.get("query1") is None
        assert cache.get("query2") is not None
        assert cache.get("query3") is not None


class TestAnalytics:
    def test_log_search(self):
        with TemporaryDirectory() as tmpdir:
            store = AnalyticsStore(Path(tmpdir))
            analytics = SearchAnalytics(
                query="test query",
                result_count=5,
                response_time_ms=123.45,
            )
            store.log_search(analytics)
            recent = store.get_recent_queries(limit=10)
            assert len(recent) > 0
            assert recent[-1]["query"] == "test query"

    def test_search_stats(self):
        with TemporaryDirectory() as tmpdir:
            store = AnalyticsStore(Path(tmpdir))
            for i in range(3):
                store.log_search(
                    SearchAnalytics(
                        query=f"query {i}",
                        result_count=10 + i,
                        response_time_ms=100 + i * 10,
                    )
                )
            stats = store.get_search_stats()
            assert stats["total_searches"] == 3
            assert stats["avg_results"] > 10

    def test_empty_search_stats(self):
        with TemporaryDirectory() as tmpdir:
            store = AnalyticsStore(Path(tmpdir))
            stats = store.get_search_stats()
            assert stats["total_searches"] == 0
            assert stats["top_queries"] == []


class TestURLs:
    def test_canonicalize(self):
        assert canonicalize("https://example.com/") is not None
        assert canonicalize("http://example.com:80/path") is not None

        url1 = canonicalize("https://example.com/page#section")
        url2 = canonicalize("https://example.com/page")
        assert url1 == url2

        # tracking params removed
        url3 = canonicalize("https://example.com/?utm_source=twitter&id=1")
        url4 = canonicalize("https://example.com/?id=1")
        assert url3 == url4

        assert canonicalize("not a url") is None
        assert canonicalize("ftp://example.com") is None