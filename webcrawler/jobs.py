"""Persistent crawl jobs and rate-limit bookkeeping."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any


class CrawlJobStore:
    """A small SQLite job store that survives API process restarts."""

    def __init__(self, data_dir: Path) -> None:
        data_dir.mkdir(parents=True, exist_ok=True)
        self.path = data_dir / "crawl_jobs.sqlite3"
        self._lock = Lock()
        conn = self._connect()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS crawl_jobs (
                    job_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    progress INTEGER NOT NULL DEFAULT 0,
                    pages_found INTEGER NOT NULL DEFAULT 0,
                    pages_stored INTEGER NOT NULL DEFAULT 0,
                    message TEXT NOT NULL,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    finished_at TEXT
                );
                CREATE TABLE IF NOT EXISTS crawl_rate_limits (
                    ip TEXT NOT NULL,
                    requested_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_crawl_rate_limits_ip_time
                    ON crawl_rate_limits (ip, requested_at);
                """
            )
            # A background task cannot resume after a process restart. Mark it
            # clearly rather than leaving a permanently spinning UI.
            conn.execute(
                "UPDATE crawl_jobs SET status = 'failed', error = ?, "
                "message = ?, finished_at = ? WHERE status = 'running'",
                ("The server restarted before this crawl completed.", "Crawl interrupted by server restart.", self._now()),
            )
            conn.commit()
        finally:
            conn.close()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def create(self, job_id: str, message: str) -> None:
        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    "INSERT INTO crawl_jobs (job_id, status, message, created_at) VALUES (?, 'running', ?, ?)",
                    (job_id, message, self._now()),
                )
                conn.commit()
            finally:
                conn.close()

    def update(self, job_id: str, **values: Any) -> None:
        allowed = {"status", "progress", "pages_found", "pages_stored", "message", "error", "finished_at"}
        values = {key: value for key, value in values.items() if key in allowed}
        if not values:
            return
        if values.get("status") in {"complete", "failed"} and "finished_at" not in values:
            values["finished_at"] = self._now()
        columns = ", ".join(f"{key} = ?" for key in values)
        with self._lock:
            conn = self._connect()
            try:
                conn.execute(f"UPDATE crawl_jobs SET {columns} WHERE job_id = ?", (*values.values(), job_id))
                conn.commit()
            finally:
                conn.close()

    def get(self, job_id: str) -> dict[str, Any] | None:
        conn = self._connect()
        try:
            row = conn.execute("SELECT * FROM crawl_jobs WHERE job_id = ?", (job_id,)).fetchone()
        finally:
            conn.close()
        return dict(row) if row else None

    def latest_running(self) -> tuple[str, dict[str, Any]] | None:
        conn = self._connect()
        try:
            row = conn.execute(
                "SELECT * FROM crawl_jobs WHERE status = 'running' ORDER BY created_at DESC LIMIT 1"
            ).fetchone()
        finally:
            conn.close()
        return (row["job_id"], dict(row)) if row else None

    def allow_request(self, ip: str, *, max_requests: int, window_seconds: int) -> bool:
        """Atomically enforce a sliding-window limit across API restarts."""
        cutoff = datetime.now(timezone.utc).timestamp() - window_seconds
        now = datetime.now(timezone.utc).timestamp()
        with self._lock:
            conn = self._connect()
            try:
                conn.execute("DELETE FROM crawl_rate_limits WHERE requested_at < ?", (cutoff,))
                count = conn.execute(
                    "SELECT COUNT(*) FROM crawl_rate_limits WHERE ip = ? AND requested_at >= ?", (ip, cutoff)
                ).fetchone()[0]
                if count >= max_requests:
                    return False
                conn.execute("INSERT INTO crawl_rate_limits (ip, requested_at) VALUES (?, ?)", (ip, now))
                conn.commit()
                return True
            finally:
                conn.close()
