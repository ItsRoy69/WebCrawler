from __future__ import annotations

import hashlib
import re
from pathlib import Path

import numpy as np

TOKEN_RE = re.compile(r"[\w']+", re.UNICODE)


class HashingEmbedder:
    """A deterministic, dependency-free baseline encoder for pipeline testing."""
    name = "hashing-v1"

    def __init__(self, dimensions: int = 384):
        self.dimensions = dimensions

    def encode(self, texts: list[str], batch_size: int = 128) -> np.ndarray:
        vectors = np.zeros((len(texts), self.dimensions), dtype=np.float32)
        for row, text in enumerate(texts):
            tokens = TOKEN_RE.findall(text.lower())
            for token in tokens:
                digest = hashlib.blake2b(token.encode(), digest_size=8).digest()
                bucket = int.from_bytes(digest, "little") % self.dimensions
                vectors[row, bucket] += 1 if digest[0] & 1 else -1
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        return vectors / np.maximum(norms, 1e-12)


class SentenceTransformerEmbedder:
    def __init__(self, model: str):
        from sentence_transformers import SentenceTransformer
        self.model, self.name = SentenceTransformer(model), model

    def encode(self, texts: list[str], batch_size: int = 128) -> np.ndarray:
        return self.model.encode(texts, batch_size=batch_size, normalize_embeddings=True, show_progress_bar=True).astype(np.float32)


def get_embedder(model: str | None):
    return SentenceTransformerEmbedder(model) if model else HashingEmbedder()


def save_vectors(path: Path, vectors: np.ndarray) -> None:
    np.save(path, vectors.astype(np.float32))
