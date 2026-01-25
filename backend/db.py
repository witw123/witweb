from pathlib import Path
import sqlite3

from passlib.hash import bcrypt

DB_PATH = Path(__file__).resolve().parent / "blog.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_column(cur: sqlite3.Cursor, table: str, column: str, ddl: str) -> None:
    cur.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cur.fetchall()}
    if column not in existing:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db(admin_username: str, admin_password: str) -> None:
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY,
          username TEXT UNIQUE,
          password TEXT,
          nickname TEXT,
          avatar_url TEXT
        )
        """
    )
    _ensure_column(cur, "users", "nickname", "nickname TEXT")
    _ensure_column(cur, "users", "avatar_url", "avatar_url TEXT")
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS posts (
          id INTEGER PRIMARY KEY,
          title TEXT,
          slug TEXT UNIQUE,
          content TEXT,
          created_at TEXT,
          author TEXT,
          tags TEXT
        )
        """
    )
    _ensure_column(cur, "posts", "author", "author TEXT")
    _ensure_column(cur, "posts", "tags", "tags TEXT")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS likes (
          id INTEGER PRIMARY KEY,
          post_id INTEGER,
          username TEXT,
          created_at TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS dislikes (
          id INTEGER PRIMARY KEY,
          post_id INTEGER,
          username TEXT,
          created_at TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS comments (
          id INTEGER PRIMARY KEY,
          post_id INTEGER,
          author TEXT,
          content TEXT,
          created_at TEXT,
          parent_id INTEGER,
          ip_address TEXT
        )
        """
    )
    _ensure_column(cur, "comments", "parent_id", "parent_id INTEGER")
    _ensure_column(cur, "comments", "ip_address", "ip_address TEXT")
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, username)"
    )
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_dislikes_post_user ON dislikes(post_id, username)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_dislikes_post ON dislikes(post_id)"
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS comment_votes (
          id INTEGER PRIMARY KEY,
          comment_id INTEGER,
          username TEXT,
          value INTEGER,
          created_at TEXT
        )
        """
    )
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_vote ON comment_votes(comment_id, username)"
    )

    cur.execute("SELECT id FROM users WHERE username = ?", (admin_username,))
    if cur.fetchone() is None:
        cur.execute(
            "INSERT INTO users (username, password, nickname, avatar_url) VALUES (?, ?, ?, ?)",
            (admin_username, bcrypt.hash(admin_password), admin_username, ""),
        )

    conn.commit()
    conn.close()
