from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

import numpy as np

from .bm25 import BM25Index
from .embeddings import get_embedder
from .hnsw import HNSWIndex
from .store import CorpusStore


def build_index(
    data_dir: Path,
    model: str | None = None,
    batch_size: int = 128,
    m: int = 16,
    ef_construction: int = 200,
    output_dir: Path | None = None,
) -> dict:
    store = CorpusStore(data_dir)
    documents = list(store.iter_documents())
    store.close()

    if not documents:
        raise ValueError("no documents found; crawl or ingest a WARC first")

    base = output_dir or data_dir / "index"
    base.mkdir(exist_ok=True)

    texts = [d["text"] for d in documents]
    BM25Index.build(texts).save(base / "bm25.json")

    encoder = get_embedder(model)
    vectors = encoder.encode(texts, batch_size=batch_size)
    np.save(base / "vectors.npy", vectors.astype("float32"))

    hnsw = HNSWIndex(vectors.shape[1], m=m, ef_construction=ef_construction)
    hnsw.add_many(vectors)
    hnsw.save(base / "hnsw.npz")

    manifest = {
        "documents": documents,
        "embedding_model": encoder.name,
        "dimensions": int(vectors.shape[1]),
        "hnsw": {"m": m, "ef_construction": ef_construction},
    }
    (base / "manifest.json").write_text(json.dumps(manifest), encoding="utf8")

    return {
        "documents": len(documents),
        "dimensions": int(vectors.shape[1]),
        "embedding_model": encoder.name,
    }


def rebuild_index_atomically(data_dir: Path) -> dict:
    """Build a complete new index before swapping it into service."""
    staging = data_dir / ".index-staging"
    backup = data_dir / ".index-backup"
    live = data_dir / "index"
    shutil.rmtree(staging, ignore_errors=True)
    shutil.rmtree(backup, ignore_errors=True)
    try:
        result = build_index(data_dir, output_dir=staging)
        if live.exists():
            os.replace(live, backup)
        try:
            os.replace(staging, live)
        except Exception:
            if backup.exists():
                os.replace(backup, live)
            raise
        shutil.rmtree(backup, ignore_errors=True)
        return result
    finally:
        shutil.rmtree(staging, ignore_errors=True)
