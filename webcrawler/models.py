from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ExtractedPage:
    title: str
    text: str
    links: list[str]
