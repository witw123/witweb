#!/usr/bin/env python
"""One-time migration from legacy single DB to split DBs."""
from __future__ import annotations
import os
import sqlite3
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
LEGACY_DB = Path(os.getenv("SORA_LEGACY_DB_PATH", DATA_DIR / "blog.db"))
USERS_DB = Path(os.getenv("SORA_USERS_DB_PATH", DATA_DIR / "users.db"))
BLOG_DB = Path(os.getenv("SORA_BLOG_DB_PATH", DATA_DIR / "blog.db"))
CHANNEL_DB = Path(os.getenv("SORA_CHANNEL_DB_PATH", DATA_DIR / "channel.db"))
STUDIO_DB = Path(os.getenv("SORA_STUDIO_DB_PATH", DATA_DIR / "studio.db"))
MARKER = Path(os.getenv("SORA_MIGRATION_MARKER", DATA_DIR / ".multi_db_migrated"))

USERS_TABLES = ["users", "follows"]


def is_same_db(a: Path, b: Path) -> bool:
    try:
        return a.resolve() == b.resolve()
    except Exception:
        return str(a) == str(b)


BLOG_TABLES = ["posts", "comments", "likes", "dislikes", "comment_votes", "favorites"]
CHANNEL_TABLES = ["channels", "messages"]
STUDIO_TABLES = ["video_tasks", "video_results", "characters", "studio_config", "studio_history", "studio_task_times", "studio_active_tasks"]


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
    return bool(row)


def table_count(conn: sqlite3.Connection, table: str) -> int:
    if not table_exists(conn, table):
        return 0
    row = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
    return int(row[0]) if row else 0


def copy_table(src: sqlite3.Connection, dest: sqlite3.Connection, table: str) -> int:
    if not table_exists(src, table) or not table_exists(dest, table):
        return 0
    cols = [r[1] for r in src.execute(f"PRAGMA table_info({table})").fetchall()]
    if not cols:
        return 0
    placeholders = ",".join(["?"] * len(cols))
    select_sql = f"SELECT {', '.join(cols)} FROM {table}"
    insert_sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders})"
    rows = src.execute(select_sql).fetchall()
    if not rows:
        return 0
    with dest:
        dest.executemany(insert_sql, rows)
    return len(rows)


def ensure_path(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)


def open_db(path: Path) -> sqlite3.Connection:
    ensure_path(path)
    return sqlite3.connect(str(path))


def migrate_tables(src: sqlite3.Connection, dest: sqlite3.Connection, tables: Iterable[str]) -> dict[str, int]:
    result: dict[str, int] = {}
    for table in tables:
        result[table] = copy_table(src, dest, table)
    return result


def main():
    if not LEGACY_DB.exists():
        print(f"Legacy DB not found: {LEGACY_DB}")
        return 1

    if MARKER.exists():
        print(f"Migration marker exists: {MARKER}")
        print("If you want to re-run migration, delete the marker file.")
        return 1

    legacy = sqlite3.connect(str(LEGACY_DB))
    users = open_db(USERS_DB)
    blog = open_db(BLOG_DB)
    channel = open_db(CHANNEL_DB)
    studio = open_db(STUDIO_DB)

    print("Migrating from legacy:", LEGACY_DB)
    print("Users DB:", USERS_DB)
    print("Blog DB:", BLOG_DB)
    print("Channel DB:", CHANNEL_DB)
    print("Studio DB:", STUDIO_DB)

    summary: dict[str, dict[str, int]] = {}

    summary["users"] = migrate_tables(legacy, users, USERS_TABLES)
    if is_same_db(LEGACY_DB, BLOG_DB):
        summary["blog"] = {t: 0 for t in BLOG_TABLES}
    else:
        summary["blog"] = migrate_tables(legacy, blog, BLOG_TABLES)
    summary["channel"] = migrate_tables(legacy, channel, CHANNEL_TABLES)
    summary["studio"] = migrate_tables(legacy, studio, STUDIO_TABLES)

    legacy.close()
    users.close()
    blog.close()
    channel.close()
    studio.close()

    MARKER.write_text("migrated\n")

    print("Migration summary:")
    for group, tables in summary.items():
        print(f"- {group}:")
        for table, count in tables.items():
            print(f"  - {table}: {count}")
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
