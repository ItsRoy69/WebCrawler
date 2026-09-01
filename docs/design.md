# Hybrid search design

The crawler writes compressed HTML and a durable SQLite corpus. `build-index` reads documents in ID order, builds a term-to-postings inverted index with BM25, batches embeddings, and inserts normalized vectors into a custom HNSW graph. The service retrieves both paths and combines ranks by weighted reciprocal-rank fusion, avoiding direct mixing of lexical and cosine scores.

`webcrawler/hnsw.py` implements Malkov and Yashunin (2018): exponentially distributed layers, greedy top-down traversal, layer-zero beam search (`ef`), bounded bidirectional neighbors (`M`), and construction beam width (`efConstruction`). It is not an ANN-library wrapper. Distance is `1 - dot(a,b)` after normalization.

## Benchmark protocol

Run five fixed-seed repeats at 1M and 10M vectors, query 1,000 held-out vectors, and compare returned IDs against exhaustive top-10 dot products. Report recall@10, median/p95 latency, graph memory, build time, and process RSS.

```powershell
python scripts/benchmark_hnsw.py --vectors 1000000 --dimensions 384 --ef 100
```

Do not publish performance numbers until this runs on target hardware. Exact ground truth needs substantial RAM at large sizes.

## 1B-vector model

384-dimensional float32 vectors consume roughly 1.43 TiB (1B × 384 × 4); an `M=16` HNSW graph adds roughly 64–128 GB in a native packed layout. Python object graphs are intentionally unsuitable at that scale. Production would shard by document ID/coarse centroid, use int8 or PQ codes (roughly 48–96 GB plus metadata), put graph data in a native memory-mapped service, replicate hot shards, and merge shard top-K before RRF/re-ranking.

The default hashing encoder is portable but not semantic understanding; use `--embedding-model sentence-transformers/all-MiniLM-L6-v2` after installing `sentence-transformers` for trained embeddings. HNSW targets recall/latency but has high incremental memory cost; IVF-PQ is better when memory is dominant. SQLite is correct for a single node, not a distributed corpus catalog.
