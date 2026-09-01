from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class SourceType(str, Enum):
    """Document source type"""

    CRAWL = "crawl"
    WARC = "warc"


@dataclass(frozen=True)
class ExtractedPage:
    """Extracted content from HTML page"""

    title: str
    text: str
    links: list[str]
    author: str | None = None
    publish_date: str | None = None
    description: str | None = None
    image_url: str | None = None


@dataclass
class SearchFilter:
    """Advanced search filters for API"""

    query: str
    domain: str | None = None
    source: SourceType | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    min_score: float = 0.0
    limit: int = 10
    offset: int = 0
    sort_by: str = "relevance"  # "relevance", "date", "domain"


@dataclass
class SearchResult:
    """Structured search result"""

    url: str
    title: str
    snippet: str
    score: float
    domain: str
    source: SourceType
    crawl_date: datetime
    author: str | None = None
    publish_date: str | None = None
    description: str | None = None
    image_url: str | None = None


@dataclass
class CrawlMetrics:
    """Crawl statistics for monitoring"""

    total_pages_found: int = 0
    total_pages_stored: int = 0
    total_pages_skipped: int = 0
    total_pages_failed: int = 0
    started_at: datetime = field(default_factory=datetime.utcnow)
    ended_at: datetime | None = None
    duration_seconds: float = 0.0
    pages_per_second: float = 0.0
    errors: dict[str, int] = field(default_factory=dict)


@dataclass
class SearchAnalytics:
    """Query analytics for monitoring"""

    query: str
    result_count: int
    response_time_ms: float
    timestamp: datetime = field(default_factory=datetime.utcnow)
    domain_filter: str | None = None
    sort_by: str = "relevance"
