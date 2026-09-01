"""Example: python scripts/benchmark_hnsw.py --vectors 100000 --dimensions 384."""
import argparse
import time
import tracemalloc
import numpy as np
from webcrawler.hnsw import HNSWIndex

parser=argparse.ArgumentParser()
parser.add_argument("--vectors",type=int,default=100_000)
parser.add_argument("--dimensions",type=int,default=384)
parser.add_argument("--queries",type=int,default=100)
parser.add_argument("--ef",type=int,default=100)
args=parser.parse_args()
rng=np.random.default_rng(42)
vectors=rng.normal(size=(args.vectors,args.dimensions)).astype(np.float32)
vectors/=np.linalg.norm(vectors,axis=1,keepdims=True)
queries=vectors[rng.choice(args.vectors,args.queries,replace=False)]
tracemalloc.start(); started=time.perf_counter()
index=HNSWIndex(args.dimensions); index.add_many(vectors)
build=time.perf_counter()-started
started=time.perf_counter(); found=[index.search(q,k=10,ef=args.ef) for q in queries]
elapsed=time.perf_counter()-started
truth=np.argpartition(-(queries@vectors.T),10,axis=1)[:,:10]
recall=np.mean([len(set(n for n,_ in actual)&set(exact))/10 for actual,exact in zip(found,truth)])
_,peak=tracemalloc.get_traced_memory()
print({"vectors":args.vectors,"build_seconds":round(build,2),"mean_ms":round(elapsed/args.queries*1000,2),"recall_at_10":round(float(recall),4),"python_peak_mib":round(peak/2**20,1)})
