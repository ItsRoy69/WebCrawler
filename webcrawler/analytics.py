"""Analytics and monitoring for searches and crawls"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from collections import deque

from .models import SearchAnalytics, CrawlMetrics


class AnalyticsStore:
    """Store and query analytics data"""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.analytics_file = data_dir / "analytics.jsonl"
        self.metrics_file = data_dir / "crawl_metrics.json"
        
        # In-memory cache (last 1000 queries)
        self.recent_queries: deque = deque(maxlen=1000)
        self._load_recent()

    def _load_recent(self) -> None:
        """Load recent queries from disk"""
        if self.analytics_file.exists():
            try:
                lines = self.analytics_file.read_text().strip().split("\n")
                for line in lines[-100:]:  # Load last 100 for memory efficiency
                    try:
                        data = json.loads(line)
                        self.recent_queries.append(data)
                    except Exception:
                        pass
            except Exception:
                pass

    def log_search(self, analytics: SearchAnalytics) -> None:
        """Log search query to disk and cache"""
        data = {
            "query": analytics.query,
            "result_count": analytics.result_count,
            "response_time_ms": analytics.response_time_ms,
            "timestamp": analytics.timestamp.isoformat(),
            "domain_filter": analytics.domain_filter,
            "sort_by": analytics.sort_by,
        }
        
        # Append to file
        with open(self.analytics_file, "a") as f:
            f.write(json.dumps(data) + "\n")
        
        # Add to recent
        self.recent_queries.append(data)

    def log_crawl_metrics(self, metrics: CrawlMetrics, origin: str) -> None:
        """Log crawl metrics"""
        data = self.metrics_file.read_text() if self.metrics_file.exists() else "{}"
        metrics_dict = json.loads(data)
        
        metrics_dict[origin] = {
            "total_pages_found": metrics.total_pages_found,
            "total_pages_stored": metrics.total_pages_stored,
            "total_pages_skipped": metrics.total_pages_skipped,
            "total_pages_failed": metrics.total_pages_failed,
            "started_at": metrics.started_at.isoformat(),
            "ended_at": metrics.ended_at.isoformat() if metrics.ended_at else None,
            "duration_seconds": metrics.duration_seconds,
            "pages_per_second": metrics.pages_per_second,
            "errors": metrics.errors,
        }
        
        self.metrics_file.write_text(json.dumps(metrics_dict, indent=2))

    def get_top_queries(self, limit: int = 10) -> list[dict]:
        """Get most common queries"""
        query_counts: dict[str, int] = {}
        for entry in self.recent_queries:
            query = entry.get("query", "")
            query_counts[query] = query_counts.get(query, 0) + 1
        
        return sorted(
            [{"query": q, "count": c} for q, c in query_counts.items()],
            key=lambda x: x["count"],
            reverse=True,
        )[:limit]

    def get_recent_queries(self, limit: int = 50) -> list[dict]:
        """Get recent search queries"""
        return list(self.recent_queries)[-limit:]

    def get_search_stats(self) -> dict:
        """Get search statistics"""
        if not self.recent_queries:
            return {
                "total_searches": 0,
                "avg_response_time_ms": 0,
                "avg_results": 0,
            }
        
        total_searches = len(self.recent_queries)
        avg_response_time = sum(q.get("response_time_ms", 0) for q in self.recent_queries) / total_searches
        avg_results = sum(q.get("result_count", 0) for q in self.recent_queries) / total_searches
        
        return {
            "total_searches": total_searches,
            "avg_response_time_ms": round(avg_response_time, 2),
            "avg_results": round(avg_results, 2),
            "top_queries": self.get_top_queries(5),
        }

    def get_crawl_stats(self, origin: str | None = None) -> dict:
        """Get crawl statistics"""
        if not self.metrics_file.exists():
            return {}
        
        metrics_dict = json.loads(self.metrics_file.read_text())
        
        if origin:
            return metrics_dict.get(origin, {})
        
        return metrics_dict
