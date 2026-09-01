"""Result caching for improved performance"""

from __future__ import annotations

import json
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from collections import OrderedDict


class SearchCache:
    """Simple LRU cache for search results"""

    def __init__(self, max_size: int = 1000, ttl_hours: int = 24):
        self.max_size = max_size
        self.ttl = timedelta(hours=ttl_hours)
        self.cache: OrderedDict[str, dict] = OrderedDict()
        self.timestamps: dict[str, datetime] = {}

    def _key(self, query: str, domain: str | None = None, limit: int = 10, offset: int = 0) -> str:
        """Generate cache key"""
        key_str = f"{query}|{domain}|{limit}|{offset}"
        return hashlib.md5(key_str.encode()).hexdigest()

    def get(self, query: str, domain: str | None = None, limit: int = 10, offset: int = 0) -> dict | None:
        """Get cached results if valid"""
        key = self._key(query, domain, limit, offset)
        
        if key not in self.cache:
            return None
        
        # Check TTL
        if datetime.now() - self.timestamps[key] > self.ttl:
            del self.cache[key]
            del self.timestamps[key]
            return None
        
        # Move to end (LRU)
        self.cache.move_to_end(key)
        return self.cache[key]

    def set(self, query: str, results: dict, domain: str | None = None, limit: int = 10, offset: int = 0) -> None:
        """Cache search results"""
        key = self._key(query, domain, limit, offset)
        
        # Remove oldest if at capacity
        if len(self.cache) >= self.max_size:
            self.cache.popitem(last=False)
            oldest_key = list(self.timestamps.keys())[0]
            if oldest_key in self.timestamps:
                del self.timestamps[oldest_key]
        
        self.cache[key] = results
        self.timestamps[key] = datetime.now()
        self.cache.move_to_end(key)

    def clear(self) -> None:
        """Clear all cache"""
        self.cache.clear()
        self.timestamps.clear()

    def size(self) -> int:
        """Get current cache size"""
        return len(self.cache)
