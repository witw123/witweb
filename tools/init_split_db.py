#!/usr/bin/env python
"""Initialize split SQLite databases (users/blog/channel/studio)."""
from __future__ import annotations
import os
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
USERS_DB = Path(os.getenv("SORA_USERS_DB_PATH", DATA_DIR / "users.db"))
BLOG_DB = Path(os.getenv("SORA_BLOG_DB_PATH", DATA_DIR / "blog.db"))
CHANNEL_DB = Path(os.getenv("SORA_CHANNEL_DB_PATH", DATA_DIR / "channel.db"))
STUDIO_DB = Path(os.getenv("SORA_STUDIO_DB_PATH", DATA_DIR / "studio.db"))


def open_db(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(str(path))


def init_users(db: sqlite3.Connection):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      nickname TEXT,
      avatar_url TEXT,
      balance REAL DEFAULT 0.0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower TEXT NOT NULL,
      following TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      UNIQUE(follower, following)
    );
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower);
    CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following);
    ''')


def init_blog(db: sqlite3.Connection):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY,
      title TEXT,
      slug TEXT UNIQUE,
      content TEXT,
      created_at TEXT,
      updated_at TEXT,
      author TEXT,
      tags TEXT,
      status TEXT DEFAULT 'published'
    );
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY,
      post_id INTEGER,
      username TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS dislikes (
      id INTEGER PRIMARY KEY,
      post_id INTEGER,
      username TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY,
      post_id INTEGER,
      author TEXT,
      content TEXT,
      created_at TEXT,
      parent_id INTEGER,
      ip_address TEXT
    );
    CREATE TABLE IF NOT EXISTS comment_votes (
      id INTEGER PRIMARY KEY,
      comment_id INTEGER,
      username TEXT,
      value INTEGER,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY,
      post_id INTEGER,
      username TEXT,
      created_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, username);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_dislikes_post_user ON dislikes(post_id, username);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_vote ON comment_votes(comment_id, username);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_post_user ON favorites(post_id, username);
    CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
    CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_dislikes_post ON dislikes(post_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_post ON favorites(post_id);
    ''')


def init_channel(db: sqlite3.Connection):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      message_count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      user_id INTEGER,
      username TEXT NOT NULL,
      user_avatar TEXT,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
    ''')


def init_studio(db: sqlite3.Connection):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS video_tasks (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      task_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      prompt TEXT,
      model TEXT,
      url TEXT,
      aspect_ratio TEXT,
      duration INTEGER,
      remix_target_id TEXT,
      size TEXT,
      pid TEXT,
      timestamps TEXT,
      result_json TEXT,
      failure_reason TEXT,
      error TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS video_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      url TEXT NOT NULL,
      remove_watermark BOOLEAN DEFAULT 0,
      pid TEXT,
      character_id TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      character_id TEXT UNIQUE NOT NULL,
      name TEXT,
      source_task_id TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS studio_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS studio_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file TEXT,
      prompt TEXT,
      time INTEGER,
      task_id TEXT,
      pid TEXT,
      url TEXT,
      duration_seconds INTEGER
    );
    CREATE TABLE IF NOT EXISTS studio_task_times (
      task_id TEXT PRIMARY KEY,
      ts INTEGER
    );
    CREATE TABLE IF NOT EXISTS studio_active_tasks (
      id TEXT PRIMARY KEY,
      prompt TEXT,
      start_time INTEGER
    );
    ''')


def main():
    users = open_db(USERS_DB)
    blog = open_db(BLOG_DB)
    channel = open_db(CHANNEL_DB)
    studio = open_db(STUDIO_DB)

    init_users(users)
    init_blog(blog)
    init_channel(channel)
    init_studio(studio)

    users.close()
    blog.close()
    channel.close()
    studio.close()
    print("init done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
