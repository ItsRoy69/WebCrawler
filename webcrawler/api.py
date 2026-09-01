from __future__ import annotations
from pathlib import Path
import os, uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from .search import HybridSearch
def create_app(data_dir:Path=Path("data"))->FastAPI:
    app=FastAPI(title="WebCrawler Hybrid Search",version="0.1.0"); state={}
    def engine():
        if "engine" not in state:
            try: state["engine"]=HybridSearch(data_dir)
            except FileNotFoundError as e: raise HTTPException(503,"Index unavailable. Run build-index first.") from e
        return state["engine"]
    @app.get("/")
    def home(): return FileResponse(Path(__file__).parent/"static"/"index.html")
    @app.get("/search")
    def search(q:str=Query(min_length=1),limit:int=Query(10,ge=1,le=100),alpha:float=Query(.5,ge=0,le=1),ef:int=Query(100,ge=10,le=1000)): return {"query":q,"results":engine().search(q,limit,alpha,ef)}
    @app.get("/stats")
    def stats():
        e=engine(); return {"documents":len(e.documents),**e.manifest}
    return app
def run(): uvicorn.run(create_app(Path(os.getenv("DATA_DIR","data"))),host="0.0.0.0",port=int(os.getenv("PORT","8000")))
