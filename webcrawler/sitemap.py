"""Sitemap parsing for better crawl coverage"""

from __future__ import annotations

import asyncio
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree as ET

import httpx


async def parse_sitemap(client: httpx.AsyncClient, sitemap_url: str) -> list[str]:
    """
    Parse sitemap.xml and return list of URLs.
    Handles sitemap index files that reference other sitemaps.
    """
    try:
        response = await client.get(sitemap_url, timeout=10.0)
        if not response.is_success:
            return []

        root = ET.fromstring(response.content)
        urls = []

        # Handle sitemap index (references other sitemaps)
        for sitemap in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}sitemap"):
            loc_elem = sitemap.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
            if loc_elem is not None and loc_elem.text:
                # Recursively parse referenced sitemaps
                child_urls = await parse_sitemap(client, loc_elem.text)
                urls.extend(child_urls)

        # Handle regular sitemap (direct URLs)
        for url_elem in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}url"):
            loc = url_elem.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
            if loc is not None and loc.text:
                urls.append(loc.text)

        return urls
    except Exception as e:
        print(f"[sitemap] error parsing {sitemap_url}: {e}", flush=True)
        return []


async def discover_sitemaps(client: httpx.AsyncClient, origin: str) -> list[str]:
    """
    Try to discover sitemaps from:
    1. robots.txt
    2. Standard locations (/sitemap.xml, /sitemap_index.xml)
    """
    urls = []

    # Try robots.txt
    robots_url = urljoin(origin, "/robots.txt")
    try:
        response = await client.get(robots_url, timeout=5.0)
        if response.is_success:
            for line in response.text.split("\n"):
                line = line.strip()
                if line.lower().startswith("sitemap:"):
                    sitemap_url = line.split(":", 1)[1].strip()
                    urls.append(sitemap_url)
    except Exception:
        pass

    # Try common sitemap locations
    for path in ["/sitemap.xml", "/sitemap_index.xml", "/sitemap1.xml"]:
        urls.append(urljoin(origin, path))

    return urls
