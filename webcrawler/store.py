from __future__ import annotations

import gzip
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


class CorpusStore:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.raw_dir = data_dir / "raw"
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(data_dir / "corpus.sqlite3")
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript("""
          PRAGMA journal_mode=WAL;
          CREATE TABLE IF NOT EXISTS frontier (
            url TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'queued',
            discovered_from TEXT, attempts INTEGER NOT NULL DEFAULT 0,
            error TEXT, updated_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS frontier_status ON frontier(status);
          CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
            text TEXT NOT NULL, content_hash TEXT NOT NULL UNIQUE, raw_path TEXT,
            source TEXT NOT NULL, fetched_at TEXT NOT NULL, http_status INTEGER,
            content_type TEXT
          );
        """)
        self.conn.commit()

    @staticmethod
    def now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def enqueue(self, url: str, discovered_from: str | None = None) -> bool:
        cursor = self.conn.execute("INSERT OR IGNORE INTO frontier(url, discovered_from, updated_at) VALUES (?, ?, ?)", (url, discovered_from, self.now()))
        self.conn.commit()
        return cursor.rowcount == 1

    def next_url(self) -> str | None:
        row = self.conn.execute("SELECT url FROM frontier WHERE status='queued' ORDER BY rowid LIMIT 1").fetchone()
        return row["url"] if row else None

    def mark(self, url: str, status: str, error: str | None = None) -> None:
        self.conn.execute("UPDATE frontier SET status=?, attempts=attempts+1, error=?, updated_at=? WHERE url=?", (status, error, self.now(), url))
        self.conn.commit()

    def save_document(self, *, url: str, title: str, text: str, html: bytes | None, source: str, http_status: int | None, content_type: str | None) -> bool:
        from .extract import text_hash
        digest = text_hash(text)
        raw_path = None
        if html:
            raw_path = str(Path("raw") / f"{digest}.html.gz")
            with gzip.open(self.data_dir / raw_path, "wb") as fh:
                fh.write(html)
        try:
            self.conn.execute("INSERT INTO documents(url,title,text,content_hash,raw_path,source,fetched_at,http_status,content_type) VALUES(?,?,?,?,?,?,?,?,?)", (url, title, text, digest, raw_path, source, self.now(), http_status, content_type))
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def close(self) -> None:
        self.conn.close()
