"""Integration tests for WebCrawler"""

import asyncio
import json
import pytest
from pathlib import Path
from datetime import datetime, timedelta
from tempfile import TemporaryDirectory

from webcrawler.store import CorpusStore
from webcrawler.extract import extract_html, text_hash
from webcrawler.models import SourceType
from webcrawler.cache import SearchCache
from webcrawler.analytics import AnalyticsStore, SearchAnalytics
from webcrawler.sitemap import parse_sitemap


class TestCorpusStore:
    """Test document storage and frontier management"""

    def test_store_document(self):
        """Test saving and retrieving documents"""
        with TemporaryDirectory() as tmpdir:
            store = CorpusStore(Path(tmpdir))
            
            # Enqueue a URL
            assert store.enqueue("https://example.com/page1")
            assert not store.enqueue("https://example.com/page1")  # Duplicate
            
            # Get next URL
            url = store.next_url()
            assert url == "https://example.com/page1"
            
            # Save document
            inserted = store.save_document(
                url="https://example.com/page1",
                title="Test Page",
                text="This is test content.",
                html=b"<html><body>Test</body></html>",
                source="crawl",
                http_status=200,
                content_type="text/html",
            )
            assert inserted
            
            # Duplicate should not insert
            inserted = store.save_document(
                url="https://example.com/page2",
                title="Test Page",
                text="This is test content.",
                html=b"<html><body>Test</body></html>",
                source="crawl",
                http_status=200,
                content_type="text/html",
            )
            assert not inserted
            
            # Mark as processed
            store.mark("https://example.com/page1", "stored")
            
            # Check stats
            assert store.document_count() == 1
            
            store.close()

    def test_metadata_persistence(self):
        """Test saving and retrieving metadata"""
        with TemporaryDirectory() as tmpdir:
            store = CorpusStore(Path(tmpdir))
            
            # Save with full metadata
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
            
            # Retrieve and verify
            docs = store.get_documents_by_source("crawl")
            assert len(docs) == 1
            assert docs[0]["author"] == "John Doe"
            assert docs[0]["publish_date"] == "2026-01-15T10:00:00Z"
            
            store.close()


class TestExtraction:
    """Test HTML extraction"""

    def test_extract_basic_content(self):
        """Test basic content extraction"""
        html = """
        <html>
            <head>
                <title>Test Page</title>
            </head>
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
        """Test metadata extraction"""
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
        """Test text hashing is deterministic"""
        text = "This is test content"
        hash1 = text_hash(text)
        hash2 = text_hash(text)
        assert hash1 == hash2
        
        # Whitespace variations should have same hash
        hash3 = text_hash("  This  is  test  content  ")
        assert hash1 == hash3


class TestCache:
    """Test search result caching"""

    def test_cache_basic(self):
        """Test basic caching"""
        cache = SearchCache(max_size=10, ttl_hours=1)
        
        results = {"results": []}
        cache.set("test query", results)
        
        cached = cache.get("test query")
        assert cached == results

    def test_cache_expiry(self):
        """Test cache expiration"""
        cache = SearchCache(max_size=10, ttl_hours=0)  # Immediate expiry
        
        import time
        results = {"results": []}
        cache.set("test", results)
        time.sleep(0.1)  # Wait for TTL to expire
        
        cached = cache.get("test")
        assert cached is None

    def test_cache_lru_eviction(self):
        """Test LRU eviction"""
        cache = SearchCache(max_size=2)
        
        cache.set("query1", {"results": [1]})
        cache.set("query2", {"results": [2]})
        cache.set("query3", {"results": [3]})  # Should evict query1
        
        assert cache.get("query1") is None
        assert cache.get("query2") is not None
        assert cache.get("query3") is not None


class TestAnalytics:
    """Test analytics tracking"""

    def test_log_search(self):
        """Test search logging"""
        with TemporaryDirectory() as tmpdir:
            store = AnalyticsStore(Path(tmpdir))
            
            analytics = SearchAnalytics(
                query="test query",
                result_count=5,
                response_time_ms=123.45,
                domain_filter=None,
            )
            
            store.log_search(analytics)
            recent = store.get_recent_queries(limit=10)
            
            assert len(recent) > 0
            assert recent[-1]["query"] == "test query"
            assert recent[-1]["result_count"] == 5

    def test_search_stats(self):
        """Test search statistics"""
        with TemporaryDirectory() as tmpdir:
            store = AnalyticsStore(Path(tmpdir))
            
            # Log multiple queries
            for i in range(3):
                analytics = SearchAnalytics(
                    query=f"query {i}",
                    result_count=10 + i,
                    response_time_ms=100 + i * 10,
                )
                store.log_search(analytics)
            
            stats = store.get_search_stats()
            assert stats["total_searches"] == 3
            assert stats["avg_results"] > 10

    def test_empty_search_stats_include_top_queries(self):
        """Zero-search analytics should still provide a safe empty list."""
        with TemporaryDirectory() as tmpdir:
            store = AnalyticsStore(Path(tmpdir))

            stats = store.get_search_stats()

            assert stats["total_searches"] == 0
            assert stats["top_queries"] == []


class TestURLs:
    """Test URL canonicalization"""

    def test_canonicalize(self):
        """Test URL canonicalization"""
        from webcrawler.urls import canonicalize
        
        # Basic URLs
        assert canonicalize("https://example.com/") is not None
        assert canonicalize("http://example.com:80/path") is not None
        
        # Fragment removal
        url1 = canonicalize("https://example.com/page#section")
        url2 = canonicalize("https://example.com/page")
        assert url1 == url2  # Fragments should be removed
        
        # Invalid URLs
        assert canonicalize("not a url") is None


class TestSearchAPI:
    """Test search API endpoints (requires running server)"""

    @pytest.mark.skip(reason="Requires running server")
    async def test_search_endpoint(self):
        """Test /search endpoint"""
        # This would test against a running API server
        pass


if __name__ == "__main__":
    # Run tests with: python -m pytest tests/test_integration.py -v
    pytest.main([__file__, "-v"])
