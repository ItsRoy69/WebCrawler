from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser
from typing import Callable, Optional

import httpx

from .extract import extract_html
from .models import CrawlMetrics
from .sitemap import discover_sitemaps, parse_sitemap
from .store import CorpusStore
from .urls import canonicalize, origin

logger = logging.getLogger("webcrawler.crawler")

# Refresh robots.txt after this many seconds
ROBOTS_TTL = 3600


class Crawler:
    def __init__(
        self,
        store: CorpusStore,
        seeds: list[str],
        *,
        max_pages: int,
        delay: float,
        allowed_domains: set[str] | None = None,
        use_sitemaps: bool = True,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ):
        self.store = store
        self.max_pages = max_pages
        self.delay = delay
        normalized = [canonicalize(s) for s in seeds]
        self.allowed_domains = allowed_domains or {
            urlsplit(s).hostname for s in normalized if s
        }
        # Treat www and apex hosts as the same crawl origin. Many sites emit
        # sitemap URLs on the opposite hostname from the submitted seed.
        self.allowed_domains = {
            alias
            for domain in self.allowed_domains
            for alias in (domain, domain[4:] if domain.startswith("www.") else f"www.{domain}")
        }
        self.last_request: dict[str, float] = defaultdict(float)
        self.robots: dict[str, tuple[RobotFileParser | None, float]] = {}
        self.use_sitemaps = use_sitemaps
        self.metrics = CrawlMetrics()
        self.progress_callback = progress_callback

        for seed in normalized:
            if seed:
                # A previous failed/out-of-scope attempt must not permanently
                # prevent a later crawl from retrying the seed.
                store.enqueue(seed, reset=True)

    def allowed(self, url: str) -> bool:
        return urlsplit(url).hostname in self.allowed_domains

    async def robot_allowed(self, client: httpx.AsyncClient, url: str) -> bool:
        site = origin(url)
        now = time.monotonic()

        cached = self.robots.get(site)
        if cached is not None:
            parser, fetched_at = cached
            if now - fetched_at < ROBOTS_TTL:
                return parser is not None and parser.can_fetch(
                    "WebCrawlerResearchBot", url
                )

        parser = RobotFileParser(site + "/robots.txt")
        try:
            response = await client.get(parser.url, timeout=5.0)
            if response.status_code == 404:
                parser.parse([])
            elif response.is_success:
                parser.parse(response.text.splitlines())
            else:
                # temporary failure → disallow for safety
                self.robots[site] = (None, now)
                return False
        except httpx.HTTPError:
            self.robots[site] = (None, now)
            return False

        self.robots[site] = (parser, now)
        return parser.can_fetch("WebCrawlerResearchBot", url)

    async def discover_and_queue_sitemaps(self, client: httpx.AsyncClient) -> None:
        if not self.use_sitemaps:
            return

        for domain in self.allowed_domains:
            try:
                domain_origin = f"https://{domain}"
                sitemap_urls = await discover_sitemaps(client, domain_origin)
                for sitemap_url in sitemap_urls:
                    try:
                        urls = await parse_sitemap(client, sitemap_url)
                        for url in urls:
                            if self.allowed(url):
                                self.store.enqueue(
                                    url, f"sitemap:{sitemap_url}", reset=True
                                )
                        logger.info(
                            "Discovered %d URLs from sitemap %s",
                            len(urls),
                            sitemap_url,
                        )
                    except Exception as e:
                        logger.warning("Error parsing sitemap %s: %s", sitemap_url, e)
            except Exception as e:
                logger.warning("Error discovering sitemaps for %s: %s", domain, e)

    async def crawl(self) -> int:
        stored = 0
        headers = {
            "User-Agent": "WebCrawlerResearchBot/0.1 (+contact: crawler@example.invalid)"
        }

        async with httpx.AsyncClient(
            headers=headers, follow_redirects=True, timeout=20.0
        ) as client:
            if self.use_sitemaps:
                await self.discover_and_queue_sitemaps(client)

            while stored < self.max_pages:
                url = self.store.next_url()
                if not url:
                    break

                if not self.allowed(url):
                    self.store.mark(url, "out_of_scope")
                    self.metrics.total_pages_skipped += 1
                    continue

                if not await self.robot_allowed(client, url):
                    self.store.mark(url, "robots_denied")
                    self.metrics.total_pages_skipped += 1
                    continue

                wait = self.delay - (
                    time.monotonic() - self.last_request[origin(url)]
                )
                if wait > 0:
                    await asyncio.sleep(wait)

                try:
                    response = await client.get(url)
                    self.last_request[origin(url)] = time.monotonic()
                    self.metrics.total_pages_found += 1

                    if (
                        not response.is_success
                        or "html"
                        not in response.headers.get("content-type", "").lower()
                    ):
                        self.store.mark(
                            url, "skipped", f"HTTP {response.status_code}"
                        )
                        self.metrics.total_pages_skipped += 1
                        continue

                    page = extract_html(response.content, str(response.url))
                    if not page.text:
                        self.store.mark(url, "empty")
                        self.metrics.total_pages_skipped += 1
                        continue

                    fetched_url = canonicalize(str(response.url)) or url
                    inserted = self.store.save_document(
                        url=fetched_url,
                        title=page.title,
                        text=page.text,
                        html=response.content,
                        source="crawl",
                        http_status=response.status_code,
                        content_type=response.headers.get("content-type"),
                        author=page.author,
                        publish_date=page.publish_date,
                        description=page.description,
                        image_url=page.image_url,
                    )

                    self.store.mark(url, "stored" if inserted else "duplicate")
                    if inserted:
                        stored += 1
                        self.metrics.total_pages_stored += 1

                        if self.progress_callback:
                            self.progress_callback(
                                pages_found=self.metrics.total_pages_found,
                                pages_stored=self.metrics.total_pages_stored,
                                msg=f"Stored {stored}/{self.max_pages}",
                            )
                    else:
                        self.metrics.total_pages_skipped += 1

                    for link in page.links:
                        if self.allowed(link):
                            self.store.enqueue(link, url)

                except httpx.HTTPError as exc:
                    self.store.mark(url, "failed", str(exc)[:500])
                    self.metrics.total_pages_failed += 1
                    err_name = type(exc).__name__
                    self.metrics.errors[err_name] = (
                        self.metrics.errors.get(err_name, 0) + 1
                    )
                    logger.warning("Failed to fetch %s: %s", url, exc)

        return stored
