from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

TOKEN_RE = re.compile(r"[\w']+", re.UNICODE)


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall(text.lower())


class BM25Index:
    """Portable inverted index with BM25 scoring (Robertson et al.)."""
    def __init__(self, postings: dict[str, list[list[int]]], lengths: list[int], *, k1: float = 1.2, b: float = 0.75):
        self.postings, self.lengths, self.k1, self.b = postings, lengths, k1, b
        self.avgdl = sum(lengths) / len(lengths) if lengths else 0.0

    @classmethod
    def build(cls, texts: list[str]) -> "BM25Index":
        postings: dict[str, list[list[int]]] = defaultdict(list)
        lengths = []
        for doc_id, text in enumerate(texts):
            terms = tokenize(text)
            lengths.append(len(terms))
            for term, frequency in Counter(terms).items():
                postings[term].append([doc_id, frequency])
        return cls(dict(postings), lengths)

    def search(self, query: str, limit: int = 100) -> list[tuple[int, float]]:
        scores: dict[int, float] = defaultdict(float)
        n = len(self.lengths)
        for term in tokenize(query):
            posting = self.postings.get(term, [])
            if not posting:
                continue
            # BM25's common IDF formulation, positive even for frequent terms.
            idf = math.log(1 + (n - len(posting) + 0.5) / (len(posting) + 0.5))
            for doc_id, tf in posting:
                denominator = tf + self.k1 * (1 - self.b + self.b * self.lengths[doc_id] / max(self.avgdl, 1))
                scores[doc_id] += idf * tf * (self.k1 + 1) / denominator
        return sorted(scores.items(), key=lambda result: result[1], reverse=True)[:limit]

    def save(self, path: Path) -> None:
        path.write_text(json.dumps({"postings": self.postings, "lengths": self.lengths, "k1": self.k1, "b": self.b}), encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "BM25Index":
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(data["postings"], data["lengths"], k1=data["k1"], b=data["b"])
