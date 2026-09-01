from __future__ import annotations
import json
from pathlib import Path
from .bm25 import BM25Index
from .embeddings import get_embedder
from .hnsw import HNSWIndex
from .store import CorpusStore

def build_index(data_dir: Path, model: str|None=None, batch_size: int=128, m: int=16, ef_construction: int=200) -> dict:
    store=CorpusStore(data_dir)
    try: rows=store.conn.execute("SELECT id,url,title,text FROM documents ORDER BY id").fetchall()
    finally: store.close()
    if not rows: raise ValueError("no documents found; crawl or ingest a WARC first")
    base=data_dir/"index"; base.mkdir(exist_ok=True)
    documents=[{"id":r["id"],"url":r["url"],"title":r["title"],"text":r["text"]} for r in rows]
    texts=[d["text"] for d in documents]
    BM25Index.build(texts).save(base/"bm25.json")
    encoder=get_embedder(model); vectors=encoder.encode(texts,batch_size=batch_size)
    import numpy as np
    np.save(base/"vectors.npy",vectors.astype("float32"))
    hnsw=HNSWIndex(vectors.shape[1],m=m,ef_construction=ef_construction); hnsw.add_many(vectors); hnsw.save(base/"hnsw.npz")
    manifest={"documents":documents,"embedding_model":encoder.name,"dimensions":int(vectors.shape[1]),"hnsw":{"m":m,"ef_construction":ef_construction}}
    (base/"manifest.json").write_text(json.dumps(manifest),encoding="utf8")
    return {"documents":len(documents),"dimensions":int(vectors.shape[1]),"embedding_model":encoder.name}
