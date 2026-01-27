from pathlib import Path
import os
import sqlite3

from passlib.hash import bcrypt

try:
    import pymysql
except ImportError:
    pymysql = None

try:
    from .config import DB_PATH, DATA_DIR
except ImportError:
    from config import DB_PATH, DATA_DIR

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)


def _db_type() -> str:
    return os.getenv("DB_TYPE", "sqlite").strip().lower()


def is_mysql() -> bool:
    return _db_type() == "mysql"


def adapt_query(sql: str) -> str:
    if is_mysql():
        return sql.replace("?", "%s")
    return sql


def get_conn():
    if is_mysql():
        if pymysql is None:
            raise RuntimeError("pymysql is not installed")
        return pymysql.connect(
            host=os.getenv("MYSQL_HOST", "127.0.0.1"),
            port=int(os.getenv("MYSQL_PORT", "3306")),
            user=os.getenv("MYSQL_USER", "root"),
            password=os.getenv("MYSQL_PASSWORD", ""),
            database=os.getenv("MYSQL_DB", "sora2_web"),
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False,
        )
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_column(cur, table: str, column: str, ddl: str) -> None:
    if is_mysql():
        return
    cur.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cur.fetchall()}
    if column not in existing:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db(admin_username: str, admin_password: str) -> None:
    conn = get_conn()
    cur = conn.cursor()

    def _mysql_create_index(sql: str) -> None:
        try:
            cur.execute(sql)
        except Exception:
            pass

    if is_mysql():
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INT AUTO_INCREMENT PRIMARY KEY,
              username VARCHAR(64) UNIQUE,
              password TEXT,
              nickname TEXT,
              avatar_url LONGTEXT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS posts (
              id INT AUTO_INCREMENT PRIMARY KEY,
              title TEXT,
              slug VARCHAR(255) UNIQUE,
              content LONGTEXT,
              created_at VARCHAR(64),
              author VARCHAR(64),
              tags TEXT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS likes (
              id INT AUTO_INCREMENT PRIMARY KEY,
              post_id INT,
              username VARCHAR(64),
              created_at VARCHAR(64)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS dislikes (
              id INT AUTO_INCREMENT PRIMARY KEY,
              post_id INT,
              username VARCHAR(64),
              created_at VARCHAR(64)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS comments (
              id INT AUTO_INCREMENT PRIMARY KEY,
              post_id INT,
              author VARCHAR(64),
              content LONGTEXT,
              created_at VARCHAR(64),
              parent_id INT,
              ip_address VARCHAR(64)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS comment_votes (
              id INT AUTO_INCREMENT PRIMARY KEY,
              comment_id INT,
              username VARCHAR(64),
              value INT,
              created_at VARCHAR(64)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS favorites (
              id INT AUTO_INCREMENT PRIMARY KEY,
              post_id INT,
              username VARCHAR(64),
              created_at VARCHAR(64)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        _mysql_create_index(
            "ALTER TABLE likes ADD UNIQUE INDEX idx_likes_post_user (post_id, username)"
        )
        _mysql_create_index(
            "ALTER TABLE dislikes ADD UNIQUE INDEX idx_dislikes_post_user (post_id, username)"
        )
        _mysql_create_index(
            "ALTER TABLE comment_votes ADD UNIQUE INDEX idx_comment_vote (comment_id, username)"
        )
        _mysql_create_index(
            "CREATE INDEX idx_posts_author ON posts(author)"
        )
        _mysql_create_index(
            "CREATE INDEX idx_posts_created_at ON posts(created_at)"
        )
        _mysql_create_index(
            "CREATE INDEX idx_comments_post ON comments(post_id)"
        )
        _mysql_create_index(
            "CREATE INDEX idx_comments_created_at ON comments(created_at)"
        )
        _mysql_create_index(
            "CREATE INDEX idx_likes_post ON likes(post_id)"
        )
        _mysql_create_index(
            "CREATE INDEX idx_dislikes_post ON dislikes(post_id)"
        )
        _mysql_create_index(
            "ALTER TABLE favorites ADD UNIQUE INDEX idx_favorites_post_user (post_id, username)"
        )
        _mysql_create_index(
            "CREATE INDEX idx_favorites_post ON favorites(post_id)"
        )
    else:
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

    if is_mysql():
        cur.execute("SELECT id FROM users WHERE username = %s", (admin_username,))
    else:
        cur.execute("SELECT id FROM users WHERE username = ?", (admin_username,))
    if cur.fetchone() is None:
        if is_mysql():
            cur.execute(
                "INSERT INTO users (username, password, nickname, avatar_url) VALUES (%s, %s, %s, %s)",
                (admin_username, bcrypt.hash(admin_password), admin_username, ""),
            )
        else:
            cur.execute(
                "INSERT INTO users (username, password, nickname, avatar_url) VALUES (?, ?, ?, ?)",
                (admin_username, bcrypt.hash(admin_password), admin_username, ""),
            )

    conn.commit()
    conn.close()
