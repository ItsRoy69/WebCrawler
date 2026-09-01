from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

from .extract import extract_html
from .store import CorpusStore
from .urls import canonicalize, origin


class Crawler:
    def __init__(self, store: CorpusStore, seeds: list[str], *, max_pages: int, delay: float, allowed_domains: set[str] | None = None):
        self.store, self.max_pages, self.delay = store, max_pages, delay
        normalized = [canonicalize(s) for s in seeds]
        self.allowed_domains = allowed_domains or {urlsplit(s).hostname for s in normalized if s}
        self.last_request: dict[str, float] = defaultdict(float)
        self.robots: dict[str, RobotFileParser | None] = {}
        for seed in normalized:
            if seed:
                store.enqueue(seed)

    def allowed(self, url: str) -> bool:
        return urlsplit(url).hostname in self.allowed_domains

    async def robot_allowed(self, client: httpx.AsyncClient, url: str) -> bool:
        site = origin(url)
        if site not in self.robots:
            parser = RobotFileParser(site + "/robots.txt")
            try:
                response = await client.get(parser.url)
                if response.status_code == 404:
                    parser.parse([])
                elif response.is_success:
                    parser.parse(response.text.splitlines())
                else:
                    self.robots[site] = None
                    return False
            except httpx.HTTPError:
                self.robots[site] = None
                return False
            self.robots[site] = parser
        parser = self.robots[site]
        return parser is not None and parser.can_fetch("WebCrawlerResearchBot", url)

    async def crawl(self) -> int:
        stored = 0
        headers = {"User-Agent": "WebCrawlerResearchBot/0.1 (+contact: crawler@example.invalid)"}
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=20.0) as client:
            while stored < self.max_pages:
                url = self.store.next_url()
                if not url:
                    break
                if not self.allowed(url):
                    self.store.mark(url, "out_of_scope")
                    continue
                if not await self.robot_allowed(client, url):
                    self.store.mark(url, "robots_denied")
                    continue
                wait = self.delay - (time.monotonic() - self.last_request[origin(url)])
                if wait > 0:
                    await asyncio.sleep(wait)
                try:
                    response = await client.get(url)
                    self.last_request[origin(url)] = time.monotonic()
                    if not response.is_success or "html" not in response.headers.get("content-type", "").lower():
                        self.store.mark(url, "skipped", f"HTTP {response.status_code}")
                        continue
                    page = extract_html(response.content, str(response.url))
                    if not page.text:
                        self.store.mark(url, "empty")
                        continue
                    inserted = self.store.save_document(url=url, title=page.title, text=page.text, html=response.content, source="crawl", http_status=response.status_code, content_type=response.headers.get("content-type"))
                    self.store.mark(url, "stored" if inserted else "duplicate")
                    if inserted:
                        stored += 1
                    for link in page.links:
                        if self.allowed(link):
                            self.store.enqueue(link, url)
                except httpx.HTTPError as exc:
                    self.store.mark(url, "failed", str(exc)[:500])
        return stored
