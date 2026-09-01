from __future__ import annotations

import re
import hashlib
from bs4 import BeautifulSoup

from .models import ExtractedPage
from .urls import canonicalize


def extract_html(html: bytes | str, base_url: str) -> ExtractedPage:
    """Extract structured content from HTML page"""
    soup = BeautifulSoup(html, "html.parser")

    # Extract metadata before removing non-content tags
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    
    # Try to extract from OG tags (Open Graph)
    description = None
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        description = og_desc["content"]
    else:
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            description = meta_desc["content"]
    
    # Extract publish date
    publish_date = None
    for attr_name in ["article:published_time", "datePublished", "date"]:
        date_meta = soup.find("meta", attrs={"property": attr_name}) or soup.find(
            "meta", attrs={"name": attr_name}
        )
        if date_meta and date_meta.get("content"):
            publish_date = date_meta["content"]
            break
    
    # Extract author
    author = None
    author_meta = soup.find("meta", attrs={"name": "author"}) or soup.find(
        "meta", attrs={"property": "article:author"}
    )
    if author_meta and author_meta.get("content"):
        author = author_meta["content"]
    
    # Extract image
    image_url = None
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        image_url = og_image["content"]

    # Remove script/style/noscript/svg/template tags, but keep meta tags for metadata extraction
    for tag in soup(["script", "style", "noscript", "svg", "template"]):
        tag.decompose()

    # Extract text
    text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True)).strip()

    # Extract links
    links = []
    for anchor in soup.find_all("a", href=True):
        normalized = canonicalize(anchor["href"], base_url)
        if normalized:
            links.append(normalized)

    return ExtractedPage(
        title=title,
        text=text,
        links=list(dict.fromkeys(links)),  # Deduplicate
        author=author,
        publish_date=publish_date,
        description=description,
        image_url=image_url,
    )


def text_hash(text: str) -> str:
    """Generate deterministic hash of text content"""
    normalized = re.sub(r"\s+", " ", text).strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
