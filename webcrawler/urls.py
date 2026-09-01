from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

TRACKING_PREFIXES = ("utm_",)
TRACKING_KEYS = {"fbclid", "gclid", "mc_cid", "mc_eid"}


def canonicalize(url: str, base: str | None = None) -> str | None:
    """Return a fetchable, stable URL or None for non-HTTP URLs."""
    absolute = urljoin(base, url) if base else url
    parsed = urlsplit(absolute)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        return None
    host = parsed.hostname.lower()
    port = parsed.port
    netloc = host if port is None or (parsed.scheme == "http" and port == 80) or (parsed.scheme == "https" and port == 443) else f"{host}:{port}"
    path = parsed.path or "/"
    pairs = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)
             if k.lower() not in TRACKING_KEYS and not k.lower().startswith(TRACKING_PREFIXES)]
    return urlunsplit((parsed.scheme.lower(), netloc, path, urlencode(sorted(pairs)), ""))


def origin(url: str) -> str:
    p = urlsplit(url)
    return f"{p.scheme}://{p.netloc}"
