from __future__ import annotations

import gzip
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class CorpusStore:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.raw_dir = data_dir / "raw"
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = data_dir / "corpus.sqlite3"
        self._init_db()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                PRAGMA journal_mode=WAL;
                PRAGMA synchronous=NORMAL;
                CREATE TABLE IF NOT EXISTS frontier (
                    url TEXT PRIMARY KEY,
                    status TEXT NOT NULL DEFAULT 'queued',
                    discovered_from TEXT,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    error TEXT,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS frontier_status ON frontier(status);
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY,
                    url TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    text TEXT NOT NULL,
                    content_hash TEXT NOT NULL UNIQUE,
                    raw_path TEXT,
                    source TEXT NOT NULL,
                    fetched_at TEXT NOT NULL,
                    http_status INTEGER,
                    content_type TEXT,
                    author TEXT,
                    publish_date TEXT,
                    description TEXT,
                    image_url TEXT
                );
                CREATE INDEX IF NOT EXISTS documents_fetched ON documents(fetched_at);
                CREATE INDEX IF NOT EXISTS documents_source ON documents(source);
                """
            )

            # Keep databases created by older versions compatible with the
            # current document model. CREATE TABLE IF NOT EXISTS does not
            # alter an already-existing table.
            columns = {
                row[1]
                for row in conn.execute("PRAGMA table_info(documents)").fetchall()
            }
            for name in ("author", "publish_date", "description", "image_url"):
                if name not in columns:
                    conn.execute(f"ALTER TABLE documents ADD COLUMN {name} TEXT")

    @contextmanager
    def _connect(self):
        """Short-lived connection per operation (safer with concurrent use)."""
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    @staticmethod
    def now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def enqueue(
        self,
        url: str,
        discovered_from: str | None = None,
        *,
        reset: bool = False,
    ) -> bool:
        with self._connect() as conn:
            if reset:
                cursor = conn.execute(
                    "UPDATE frontier SET status='queued', error=NULL, updated_at=? WHERE url=?",
                    (self.now(), url),
                )
                if cursor.rowcount:
                    return True
            cursor = conn.execute(
                "INSERT OR IGNORE INTO frontier(url, discovered_from, updated_at) VALUES (?, ?, ?)",
                (url, discovered_from, self.now()),
            )
            return cursor.rowcount == 1

    def next_url(self) -> str | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT url FROM frontier WHERE status='queued' ORDER BY rowid LIMIT 1"
            ).fetchone()
            return row["url"] if row else None

    def mark(self, url: str, status: str, error: str | None = None) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE frontier SET status=?, attempts=attempts+1, error=?, updated_at=? WHERE url=?",
                (status, error, self.now(), url),
            )

    def save_document(
        self,
        *,
        url: str,
        title: str,
        text: str,
        html: bytes | None,
        source: str,
        http_status: int | None,
        content_type: str | None,
        author: str | None = None,
        publish_date: str | None = None,
        description: str | None = None,
        image_url: str | None = None,
    ) -> bool:
        from .extract import text_hash

        digest = text_hash(text)
        raw_path = None
        if html:
            raw_path = str(Path("raw") / f"{digest}.html.gz")
            with gzip.open(self.data_dir / raw_path, "wb") as fh:
                fh.write(html)

        try:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO documents(
                        url, title, text, content_hash, raw_path, source,
                        fetched_at, http_status, content_type, author,
                        publish_date, description, image_url
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        url,
                        title,
                        text,
                        digest,
                        raw_path,
                        source,
                        self.now(),
                        http_status,
                        content_type,
                        author,
                        publish_date,
                        description,
                        image_url,
                    ),
                )
            return True
        except sqlite3.IntegrityError:
            return False

    def close(self) -> None:
        # Connections are short-lived; nothing to close at store level
        pass

    def frontier_summary(self) -> dict[str, int]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT status, COUNT(*) AS count FROM frontier GROUP BY status"
            ).fetchall()
            return {row["status"]: row["count"] for row in rows}

    def document_count(self) -> int:
        with self._connect() as conn:
            return int(conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0])

    def get_documents_by_source(self, source: str) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM documents WHERE source=? ORDER BY fetched_at DESC",
                (source,),
            ).fetchall()
            return [dict(row) for row in rows]

    def document_stats(self) -> dict:
        total = self.document_count()
        with self._connect() as conn:
            by_source = conn.execute(
                "SELECT source, COUNT(*) FROM documents GROUP BY source"
            ).fetchall()
        by_status = self.frontier_summary()
        return {
            "total_documents": total,
            "by_source": {row[0]: row[1] for row in by_source},
            "frontier_status": by_status,
        }

    def iter_documents(self):
        """Yield documents ordered by id (used by indexer)."""
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, url, title, text FROM documents ORDER BY id"
            ).fetchall()
            for row in rows:
                yield dict(row)
