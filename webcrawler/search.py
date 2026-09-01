from __future__ import annotations
import json
from pathlib import Path
from .bm25 import BM25Index
from .embeddings import get_embedder
from .hnsw import HNSWIndex
class HybridSearch:
    def __init__(self,data_dir:Path):
        base=data_dir/"index"; self.manifest=json.loads((base/"manifest.json").read_text(encoding="utf8")); self.documents=self.manifest["documents"]
        self.bm25=BM25Index.load(base/"bm25.json"); self.hnsw=HNSWIndex.load(base/"hnsw.npz")
        model=self.manifest["embedding_model"]; self.embedder=get_embedder(None if model=="hashing-v1" else model)
    def search(self,query:str,limit:int=10,alpha:float=.5,ef:int=100)->list[dict]:
        lexical=self.bm25.search(query,max(limit*10,100)); semantic=self.hnsw.search(self.embedder.encode([query])[0],max(limit*10,100),ef)
        scores={}
        for rank,(doc,_) in enumerate(lexical,1): scores[doc]=scores.get(doc,0)+alpha/(60+rank)
        for rank,(doc,_) in enumerate(semantic,1): scores[doc]=scores.get(doc,0)+(1-alpha)/(60+rank)
        return [{"score":score,"title":self.documents[doc]["title"],"url":self.documents[doc]["url"],"snippet":self.documents[doc]["text"][:300]} for doc,score in sorted(scores.items(),key=lambda x:x[1],reverse=True)[:limit]]
