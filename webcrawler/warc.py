from __future__ import annotations

from urllib.request import Request, urlopen

from warcio.archiveiterator import ArchiveIterator

from .extract import extract_html
from .store import CorpusStore


def ingest_warc(store: CorpusStore, url: str, max_records: int | None = None) -> int:
    """Stream a remote Common Crawl WARC, persisting response HTML records."""
    count = 0
    request = Request(url, headers={"User-Agent": "WebCrawlerResearchBot/0.1"})
    # urlopen returns a file-like response.  ArchiveIterator reads it lazily,
    # including gzip members, so a multi-GB WARC never needs disk or RAM in full.
    with urlopen(request, timeout=60) as response:
        for record in ArchiveIterator(response):
            if record.rec_type != "response":
                continue
            target = record.rec_headers.get_header("WARC-Target-URI")
            content_type = record.http_headers.get_header("Content-Type") if record.http_headers else ""
            if not target or "html" not in (content_type or "").lower():
                continue
            body = record.content_stream().read()
            page = extract_html(body, target)
            if page.text and store.save_document(url=target, title=page.title, text=page.text, html=body, source=url, http_status=200, content_type=content_type):
                count += 1
            if max_records is not None and count >= max_records:
                break
    return count
