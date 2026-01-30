#!/usr/bin/env python
"""Verify row counts between legacy DB and split DBs."""
from __future__ import annotations
import os
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
LEGACY_DB = Path(os.getenv("SORA_LEGACY_DB_PATH", DATA_DIR / "blog.db"))
USERS_DB = Path(os.getenv("SORA_USERS_DB_PATH", DATA_DIR / "users.db"))
BLOG_DB = Path(os.getenv("SORA_BLOG_DB_PATH", DATA_DIR / "blog.db"))
CHANNEL_DB = Path(os.getenv("SORA_CHANNEL_DB_PATH", DATA_DIR / "channel.db"))
STUDIO_DB = Path(os.getenv("SORA_STUDIO_DB_PATH", DATA_DIR / "studio.db"))

CHECKS = {
    "users": (USERS_DB, ["users", "follows"]),
    "blog": (BLOG_DB, ["posts", "comments", "likes", "dislikes", "comment_votes", "favorites"]),
    "channel": (CHANNEL_DB, ["channels", "messages"]),
    "studio": (STUDIO_DB, ["video_tasks", "video_results", "characters", "studio_config", "studio_history", "studio_task_times", "studio_active_tasks"]),
}


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
    return bool(row)


def table_count(conn: sqlite3.Connection, table: str) -> int:
    if not table_exists(conn, table):
        return -1
    row = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
    return int(row[0]) if row else 0


def main():
    if not LEGACY_DB.exists():
        print(f"Legacy DB not found: {LEGACY_DB}")
        return 1

    legacy = sqlite3.connect(str(LEGACY_DB))
    ok = True

    print("Legacy:", LEGACY_DB)
    for group, (db_path, tables) in CHECKS.items():
        if not db_path.exists():
            print(f"[MISSING] {group} DB: {db_path}")
            ok = False
            continue
        dest = sqlite3.connect(str(db_path))
        print(f"\n{group} -> {db_path}")
        for table in tables:
            legacy_count = table_count(legacy, table)
            dest_count = table_count(dest, table)
            status = "OK" if legacy_count == dest_count else "DIFF"
            if legacy_count < 0 and dest_count < 0:
                status = "SKIP"
            if status == "DIFF":
                ok = False
            print(f"- {table}: legacy={legacy_count} dest={dest_count} [{status}]")
        dest.close()

    legacy.close()
    print("\nVerification:", "PASS" if ok else "FAIL")
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
