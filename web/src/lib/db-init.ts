import { getDb } from "./db";

import { hashPassword } from "./auth";

function ensureAdminUser() {
  const db = getDb();
  const adminUsername = process.env.ADMIN_USERNAME || "witw";
  const adminPassword = process.env.ADMIN_PASSWORD || "witw";
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(adminUsername);
  if (!exists) {
    db.prepare("INSERT INTO users (username, password, nickname, avatar_url) VALUES (?, ?, ?, ?)")
      .run(adminUsername, hashPassword(adminPassword), adminUsername, "");
  }
}


function ensureColumn(table: string, column: string, ddl: string) {
  const db = getDb();
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  const existing = new Set(rows.map((r: any) => r.name));
  if (!existing.has(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${ddl}`).run();
  }
}

export function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      nickname TEXT,
      avatar_url TEXT,
      balance REAL DEFAULT 0.0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
  ensureColumn("users", "nickname", "nickname TEXT");
  ensureColumn("users", "avatar_url", "avatar_url TEXT");
  ensureColumn("users", "balance", "balance REAL DEFAULT 0.0");
  ensureColumn("users", "created_at", "created_at TEXT");

  ensureAdminUser();

  db.exec(`
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
  `);
  ensureColumn("posts", "updated_at", "updated_at TEXT");
  ensureColumn("posts", "author", "author TEXT");
  ensureColumn("posts", "tags", "tags TEXT");
  ensureColumn("posts", "status", "status TEXT DEFAULT 'published'");

  db.exec(`
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
  `);
  ensureColumn("comments", "parent_id", "parent_id INTEGER");
  ensureColumn("comments", "ip_address", "ip_address TEXT");

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, username);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_dislikes_post_user ON dislikes(post_id, username);
    CREATE TABLE IF NOT EXISTS comment_votes (
      id INTEGER PRIMARY KEY,
      comment_id INTEGER,
      username TEXT,
      value INTEGER,
      created_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_vote ON comment_votes(comment_id, username);
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY,
      post_id INTEGER,
      username TEXT,
      created_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_post_user ON favorites(post_id, username);
    CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
    CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_dislikes_post ON dislikes(post_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_post ON favorites(post_id);
  `);

  db.exec(`
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
  `);
  ensureColumn("messages", "user_id", "user_id INTEGER");
  ensureColumn("messages", "user_avatar", "user_avatar TEXT");

  db.exec(`
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
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower TEXT NOT NULL,
      following TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      UNIQUE(follower, following)
    );
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower);
    CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following);
  `);
}
