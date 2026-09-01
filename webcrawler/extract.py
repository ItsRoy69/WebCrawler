from __future__ import annotations

import re
from bs4 import BeautifulSoup

from .models import ExtractedPage
from .urls import canonicalize


def extract_html(html: bytes | str, base_url: str) -> ExtractedPage:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "template"]):
        tag.decompose()
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True)).strip()
    links = []
    for anchor in soup.find_all("a", href=True):
        normalized = canonicalize(anchor["href"], base_url)
        if normalized:
            links.append(normalized)
    return ExtractedPage(title=title, text=text, links=list(dict.fromkeys(links)))


def text_hash(text: str) -> str:
    import hashlib
    normalized = re.sub(r"\s+", " ", text).strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
