from webcrawler.urls import canonicalize


def test_canonicalize_removes_fragment_and_tracking() -> None:
    assert canonicalize("HTTPS://Example.COM:443/a#part?x=y&utm_source=ad") == "https://example.com/a"


def test_canonicalize_resolves_and_preserves_meaningful_query() -> None:
    assert canonicalize("../search?q=web&utm_medium=x", "https://example.com/docs/a/") == "https://example.com/docs/search?q=web"
