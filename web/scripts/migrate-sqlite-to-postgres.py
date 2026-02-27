#!/usr/bin/env python3
import argparse
import csv
import os
import sqlite3
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, unquote

try:
    csv.field_size_limit(sys.maxsize)
except OverflowError:
    csv.field_size_limit(2147483647)


TABLE_COLUMNS = {
    "users": [
        "id",
        "username",
        "password",
        "role",
        "nickname",
        "avatar_url",
        "cover_url",
        "bio",
        "balance",
        "created_at",
        "last_read_notifications_at",
        "is_bot",
    ],
    "follows": ["id", "follower", "following", "created_at"],
    "categories": ["id", "name", "slug", "description", "sort_order", "is_active", "created_at", "updated_at"],
    "posts": [
        "id",
        "title",
        "slug",
        "content",
        "created_at",
        "updated_at",
        "author",
        "tags",
        "status",
        "category_id",
        "view_count",
    ],
    "friend_links": ["id", "name", "url", "description", "avatar_url", "sort_order", "is_active", "created_at", "updated_at"],
    "comments": ["id", "post_id", "author", "content", "created_at", "parent_id", "ip_address"],
    "likes": ["id", "post_id", "username", "created_at"],
    "dislikes": ["id", "post_id", "username", "created_at"],
    "comment_votes": ["id", "comment_id", "username", "value", "created_at"],
    "favorites": ["id", "post_id", "username", "created_at"],
    "site_visits": ["id", "visitor_id", "page_url", "user_agent", "ip_address", "created_at"],
    "unique_visitors": ["id", "visitor_id", "last_visit", "visit_count"],
    "video_tasks": [
        "id",
        "username",
        "task_type",
        "status",
        "progress",
        "prompt",
        "model",
        "url",
        "aspect_ratio",
        "duration",
        "remix_target_id",
        "size",
        "pid",
        "timestamps",
        "result_json",
        "failure_reason",
        "error",
        "created_at",
        "updated_at",
    ],
    "video_results": ["id", "task_id", "url", "remove_watermark", "pid", "character_id", "created_at"],
    "characters": ["id", "username", "character_id", "name", "source_task_id", "created_at"],
    "studio_config": ["key", "value"],
    "studio_history": ["id", "file", "prompt", "time", "task_id", "pid", "url", "duration_seconds"],
    "studio_task_times": ["task_id", "ts"],
    "studio_active_tasks": ["id", "prompt", "start_time"],
    "agent_runs": ["id", "username", "goal", "agent_type", "status", "model", "error_message", "created_at", "updated_at"],
    "agent_steps": ["id", "run_id", "step_key", "step_title", "status", "input_json", "output_json", "started_at", "finished_at"],
    "agent_artifacts": ["id", "run_id", "kind", "content", "meta_json", "created_at"],
    "topic_sources": [
        "id",
        "name",
        "url",
        "type",
        "parser_config_json",
        "enabled",
        "last_fetch_status",
        "last_fetch_error",
        "last_fetched_at",
        "last_fetch_count",
        "created_by",
        "created_at",
        "updated_at",
    ],
    "topic_items": ["id", "source_id", "title", "url", "summary", "published_at", "score", "raw_json", "fetched_at"],
    "topic_keywords": ["id", "keyword", "weight", "enabled", "created_by", "created_at", "updated_at"],
    "radar_notifications": ["id", "created_by", "type", "name", "webhook_url", "secret", "enabled", "created_at", "updated_at"],
    "radar_alert_rules": [
        "id",
        "created_by",
        "name",
        "rule_type",
        "keyword",
        "source_id",
        "min_score",
        "channel_id",
        "enabled",
        "created_at",
        "updated_at",
    ],
    "radar_alert_logs": ["id", "created_by", "item_id", "channel_id", "rule_id", "status", "response_text", "error_text", "sent_at"],
    "radar_topics": ["id", "created_by", "kind", "title", "summary", "content", "source_name", "source_url", "score", "tags_json", "created_at", "updated_at"],
    "conversations": ["id", "user1", "user2", "last_message", "last_time", "unread_count_user1", "unread_count_user2"],
    "private_messages": ["id", "conversation_id", "sender", "receiver", "content", "is_read", "created_at"],
}

SOURCE_GROUPS = {
    "users.db": ["users", "follows"],
    "blog.db": [
        "categories",
        "posts",
        "friend_links",
        "comments",
        "likes",
        "dislikes",
        "comment_votes",
        "favorites",
        "site_visits",
        "unique_visitors",
    ],
    "studio.db": [
        "video_tasks",
        "video_results",
        "characters",
        "studio_config",
        "studio_history",
        "studio_task_times",
        "studio_active_tasks",
        "agent_runs",
        "agent_steps",
        "agent_artifacts",
        "topic_sources",
        "topic_items",
        "topic_keywords",
        "radar_notifications",
        "radar_alert_rules",
        "radar_alert_logs",
        "radar_topics",
    ],
    "messages.db": ["conversations", "private_messages"],
}

IMPORT_ORDER = [
    "users",
    "follows",
    "categories",
    "posts",
    "friend_links",
    "comments",
    "likes",
    "dislikes",
    "comment_votes",
    "favorites",
    "site_visits",
    "unique_visitors",
    "video_tasks",
    "video_results",
    "characters",
    "studio_config",
    "studio_history",
    "studio_task_times",
    "studio_active_tasks",
    "agent_runs",
    "agent_steps",
    "agent_artifacts",
    "topic_sources",
    "topic_items",
    "topic_keywords",
    "radar_notifications",
    "radar_alert_rules",
    "radar_alert_logs",
    "radar_topics",
    "conversations",
    "private_messages",
]


def load_env_file(path: Path):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        t = line.strip()
        if not t or t.startswith("#") or "=" not in t:
            continue
        k, v = t.split("=", 1)
        k, v = k.strip(), v.strip()
        if len(v) >= 2 and ((v[0] == '"' and v[-1] == '"') or (v[0] == "'" and v[-1] == "'")):
            v = v[1:-1]
        os.environ.setdefault(k, v)


def parse_database_url(url: str):
    u = urlparse(url)
    if u.scheme not in ("postgres", "postgresql"):
        raise RuntimeError("DATABASE_URL must be postgres:// or postgresql://")
    return {
        "host": u.hostname or "127.0.0.1",
        "port": str(u.port or 5432),
        "user": unquote(u.username or "postgres"),
        "password": unquote(u.password or ""),
        "dbname": (u.path or "/postgres").lstrip("/"),
    }


def check_psql():
    try:
        subprocess.run(["psql", "--version"], check=True, capture_output=True, text=True)
    except Exception as exc:
        raise RuntimeError("psql not found in PATH, please configure PostgreSQL bin path first") from exc


def quote_ident(name: str):
    return '"' + name.replace('"', '""') + '"'


def sqlite_table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?", (table,)).fetchone()
    return row is not None


def sqlite_columns(conn: sqlite3.Connection, table: str):
    rows = conn.execute(f"PRAGMA table_info({quote_ident(table)})").fetchall()
    return [r[1] for r in rows]


def export_table_to_csv(conn: sqlite3.Connection, table: str, csv_path: Path) -> int:
    expected = TABLE_COLUMNS[table]
    if not sqlite_table_exists(conn, table):
        return 0
    existing = set(sqlite_columns(conn, table))
    select_list = []
    for c in expected:
        if c in existing:
            select_list.append(quote_ident(c))
        else:
            select_list.append(f"NULL AS {quote_ident(c)}")
    sql = f"SELECT {', '.join(select_list)} FROM {quote_ident(table)}"
    cur = conn.execute(sql)
    rows = cur.fetchall()
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(expected)
        for row in rows:
            w.writerow([r"\N" if v is None else v for v in row])
    return len(rows)


def run_psql(conn_info, sql: str):
    env = os.environ.copy()
    if conn_info["password"]:
        env["PGPASSWORD"] = conn_info["password"]
    env["PGCLIENTENCODING"] = "UTF8"
    cmd = [
        "psql",
        "-h",
        conn_info["host"],
        "-p",
        conn_info["port"],
        "-U",
        conn_info["user"],
        "-d",
        conn_info["dbname"],
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
    ]
    subprocess.run(cmd, check=True, env=env)


def run_psql_capture(conn_info, sql: str) -> str:
    env = os.environ.copy()
    if conn_info["password"]:
        env["PGPASSWORD"] = conn_info["password"]
    env["PGCLIENTENCODING"] = "UTF8"
    cmd = [
        "psql",
        "-h",
        conn_info["host"],
        "-p",
        conn_info["port"],
        "-U",
        conn_info["user"],
        "-d",
        conn_info["dbname"],
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
        "-c",
        sql,
    ]
    result = subprocess.run(cmd, check=True, env=env, capture_output=True, text=True)
    return result.stdout


def get_pg_table_columns(conn_info, table: str):
    sql = (
        "SELECT column_name "
        "FROM information_schema.columns "
        f"WHERE table_schema = 'public' AND table_name = '{table}' "
        "ORDER BY ordinal_position"
    )
    out = run_psql_capture(conn_info, sql)
    return [line.strip() for line in out.splitlines() if line.strip()]


def truncate_target(conn_info):
    sql = (
        "TRUNCATE TABLE "
        + ", ".join(quote_ident(t) for t in IMPORT_ORDER)
        + " RESTART IDENTITY CASCADE;"
    )
    run_psql(conn_info, sql)


def copy_csv_to_postgres(conn_info, table: str, csv_path: Path):
    expected_cols = TABLE_COLUMNS[table]
    target_cols = get_pg_table_columns(conn_info, table)
    cols = [c for c in expected_cols if c in set(target_cols)]
    if not cols:
        raise RuntimeError(f"target table {table} has no matching columns for import")

    projected_path = csv_path.with_name(f"{csv_path.stem}.projected.csv")
    with csv_path.open("r", encoding="utf-8", newline="") as rf, projected_path.open("w", encoding="utf-8", newline="") as wf:
        reader = csv.DictReader(rf)
        writer = csv.DictWriter(wf, fieldnames=cols)
        writer.writeheader()
        for row in reader:
            writer.writerow({c: row.get(c, r"\N") for c in cols})

    file_posix = str(projected_path).replace("\\", "/")
    sql = (
        f"\\copy {quote_ident(table)} ({', '.join(quote_ident(c) for c in cols)}) "
        f"FROM '{file_posix}' WITH (FORMAT csv, HEADER true, NULL '\\N', ENCODING 'UTF8')"
    )
    run_psql(conn_info, sql)


def _normalize_last_visit(value: str) -> str:
    now = datetime.now(timezone.utc).isoformat()
    if value is None:
        return now
    s = str(value).strip()
    if s == "" or s == r"\N":
        return now
    if s.isdigit():
        try:
            if len(s) == 13:
                return datetime.fromtimestamp(int(s) / 1000.0, tz=timezone.utc).isoformat()
            if len(s) == 10:
                return datetime.fromtimestamp(int(s), tz=timezone.utc).isoformat()
        except Exception:
            return now
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
    except Exception:
        pass
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y/%m/%d %H:%M:%S"):
        try:
            dt = datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except Exception:
            continue
    return now


def transform_unique_visitors_csv(src_path: Path, dst_path: Path):
    with src_path.open("r", encoding="utf-8", newline="") as rf, dst_path.open("w", encoding="utf-8", newline="") as wf:
        reader = csv.DictReader(rf)
        fieldnames = ["id", "visitor_id", "last_visit", "visit_count"]
        writer = csv.DictWriter(wf, fieldnames=fieldnames)
        writer.writeheader()
        for row in reader:
            id_v = (row.get("id") or "").strip()
            visitor_id = (row.get("visitor_id") or "").strip()
            last_visit = _normalize_last_visit(row.get("last_visit") or "")
            vc_raw = (row.get("visit_count") or "").strip()
            visit_count = vc_raw if vc_raw.isdigit() else "1"
            writer.writerow(
                {
                    "id": id_v if id_v else r"\N",
                    "visitor_id": visitor_id if visitor_id else r"\N",
                    "last_visit": last_visit,
                    "visit_count": visit_count,
                }
            )


def reset_sequences(conn_info):
    sql = """
DO $$
DECLARE r record;
DECLARE max_id bigint;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name,
      pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS seq_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND n.nspname = 'public'
      AND a.attname = 'id'
  LOOP
    IF r.seq_name IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I.%I', r.column_name, r.schema_name, r.table_name) INTO max_id;
      EXECUTE format('SELECT setval(%L, %s, true)', r.seq_name, max_id);
    END IF;
  END LOOP;
END
$$;
"""
    run_psql(conn_info, sql)


def main():
    parser = argparse.ArgumentParser(description="Migrate SQLite data files to PostgreSQL")
    parser.add_argument("--data-dir", default=str((Path.cwd() / ".." / "data").resolve()), help="Directory containing users.db/blog.db/studio.db/messages.db")
    parser.add_argument("--keep-existing", action="store_true", help="Do not truncate target tables before import")
    args = parser.parse_args()

    load_env_file(Path.cwd() / ".env.local")
    load_env_file(Path.cwd() / ".env")
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")

    check_psql()
    conn_info = parse_database_url(database_url)
    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        raise RuntimeError(f"data dir not found: {data_dir}")

    with tempfile.TemporaryDirectory(prefix="witweb_migrate_") as td:
        tmp_dir = Path(td)
        exported = {}
        for db_name, tables in SOURCE_GROUPS.items():
            db_path = data_dir / db_name
            if not db_path.exists():
                print(f"[warn] source db not found, skip: {db_path}")
                continue
            print(f"[read] {db_path}")
            conn = sqlite3.connect(str(db_path))
            try:
                for table in tables:
                    csv_file = tmp_dir / f"{table}.csv"
                    cnt = export_table_to_csv(conn, table, csv_file)
                    if cnt > 0:
                        exported[table] = csv_file
                    print(f"  - {table}: {cnt}")
            finally:
                conn.close()

        if not args.keep_existing:
            print("[db] truncating target tables ...")
            truncate_target(conn_info)

        for table in IMPORT_ORDER:
            csv_file = exported.get(table)
            if not csv_file:
                continue
            print(f"[copy] {table}")
            if table == "unique_visitors":
                transformed = tmp_dir / "unique_visitors_fixed.csv"
                transform_unique_visitors_csv(csv_file, transformed)
                copy_csv_to_postgres(conn_info, table, transformed)
            else:
                copy_csv_to_postgres(conn_info, table, csv_file)

        print("[db] resetting sequences ...")
        reset_sequences(conn_info)

    print("[done] sqlite -> postgres migration complete")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"[error] {err}", file=sys.stderr)
        sys.exit(1)
