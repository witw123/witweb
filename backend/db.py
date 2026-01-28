from pathlib import Path
import sqlite3

from passlib.hash import bcrypt

try:
    from .config import DB_PATH, DATA_DIR
except ImportError:
    from config import DB_PATH, DATA_DIR

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)


def adapt_query(sql: str) -> str:
    return sql


def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_column(cur, table: str, column: str, ddl: str) -> None:
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
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY,
          post_id INTEGER,
          username TEXT,
          created_at TEXT
        )
        """
    )
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_post_user ON favorites(post_id, username)"
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
        "CREATE INDEX IF NOT EXISTS idx_favorites_post ON favorites(post_id)"
    )

    cur.execute("SELECT id FROM users WHERE username = ?", (admin_username,))
    if cur.fetchone() is None:
        cur.execute(
            "INSERT INTO users (username, password, nickname, avatar_url) VALUES (?, ?, ?, ?)",
            (admin_username, bcrypt.hash(admin_password), admin_username, ""),
        )

    # Create channels table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            message_count INTEGER DEFAULT 0
        )
    """)
    
    # Create messages table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            user_avatar TEXT,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (channel_id) REFERENCES channels(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    
    # Create default channels if they don't exist
    default_channels = [
        ("综合讨论", "分享任何话题，自由交流"),
        ("技术交流", "讨论技术问题和编程经验"),
        ("创作分享", "分享你的创作和作品"),
    ]
    
    for name, description in default_channels:
        conn.execute(
            "INSERT OR IGNORE INTO channels (name, description) VALUES (?, ?)",
            (name, description)
        )
    
    conn.commit()
    conn.close()
