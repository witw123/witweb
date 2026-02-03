import "server-only";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { getUsersDb, getBlogDb, getStudioDb, getMessagesDb } from "./db";
import { hashPassword } from "./auth";

const DATA_DIR = path.resolve(process.cwd(), "..", "data");
const LEGACY_DB = path.join(DATA_DIR, "blog.db");
const MIGRATION_MARKER = path.join(DATA_DIR, ".multi_db_migrated");

function ensureColumn(db: any, table: string, column: string, ddl: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  const existing = new Set(rows.map((r: any) => r.name));
  if (!existing.has(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${ddl}`).run();
  }
}

function ensureAdminUser() {
  const db = getUsersDb();
  const adminUsername = process.env.ADMIN_USERNAME || "witw";
  const adminPassword = process.env.ADMIN_PASSWORD || "witw";
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(adminUsername);
  if (!exists) {
    db.prepare("INSERT INTO users (username, password, nickname, avatar_url, cover_url, bio) VALUES (?, ?, ?, ?, ?, ?)")
      .run(adminUsername, hashPassword(adminPassword), adminUsername, "", "", "");
  }
}

function initUsersDb() {
  const db = getUsersDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      nickname TEXT,
      avatar_url TEXT,
      cover_url TEXT,
      bio TEXT,
      balance REAL DEFAULT 0.0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
  ensureColumn(db, "users", "nickname", "nickname TEXT");
  ensureColumn(db, "users", "avatar_url", "avatar_url TEXT");
  ensureColumn(db, "users", "cover_url", "cover_url TEXT");
  ensureColumn(db, "users", "bio", "bio TEXT");
  ensureColumn(db, "users", "balance", "balance REAL DEFAULT 0.0");
  ensureColumn(db, "users", "created_at", "created_at TEXT");
  ensureColumn(db, "users", "last_read_notifications_at", "last_read_notifications_at TEXT DEFAULT '1970-01-01 00:00:00'");
  ensureColumn(db, "users", "is_bot", "is_bot BOOLEAN DEFAULT 0");

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

  ensureAdminUser();
  ensureSystemBot();
}

function ensureSystemBot() {
  const db = getUsersDb();
  const botUsername = "WitAI";
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(botUsername);
  if (!exists) {
    db.prepare("INSERT INTO users (username, password, nickname, avatar_url, cover_url, bio, is_bot) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(botUsername, hashPassword("bot"), "WitWeb Assistant", "", "", "我是 WitWeb 的智能助手", 1);
  }
}

function initBlogDb() {
  const db = getBlogDb();
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
  ensureColumn(db, "posts", "updated_at", "updated_at TEXT");
  ensureColumn(db, "posts", "author", "author TEXT");
  ensureColumn(db, "posts", "tags", "tags TEXT");
  ensureColumn(db, "posts", "status", "status TEXT DEFAULT 'published'");

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
  ensureColumn(db, "comments", "parent_id", "parent_id INTEGER");
  ensureColumn(db, "comments", "ip_address", "ip_address TEXT");

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
}



function initStudioDb() {
  const db = getStudioDb();
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
  `);
}

function initMessagesDb() {
  const db = getMessagesDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user1 TEXT NOT NULL,
      user2 TEXT NOT NULL,
      last_message TEXT,
      last_time DATETIME,
      unread_count_user1 INTEGER DEFAULT 0,
      unread_count_user2 INTEGER DEFAULT 0,
      UNIQUE(user1, user2)
    );
    CREATE INDEX IF NOT EXISTS idx_conv_user1 ON conversations(user1);
    CREATE INDEX IF NOT EXISTS idx_conv_user2 ON conversations(user2);

    CREATE TABLE IF NOT EXISTS private_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      receiver TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_msg_conv ON private_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_msg_sender ON private_messages(sender);
    CREATE INDEX IF NOT EXISTS idx_msg_receiver ON private_messages(receiver);
  `);
}

function tableExists(db: any, table: string) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  return !!row;
}

function tableCount(db: any, table: string) {
  if (!tableExists(db, table)) return 0;
  const row = db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get() as any;
  return row?.cnt || 0;
}

function copyTable(src: any, dest: any, table: string) {
  if (!tableExists(src, table) || !tableExists(dest, table)) return;
  const columns = (src.prepare(`PRAGMA table_info(${table})`).all() as any[]).map((c) => c.name);
  if (columns.length === 0) return;
  const placeholders = columns.map(() => "?").join(",");
  const stmt = dest.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`);
  const rows = src.prepare(`SELECT ${columns.join(",")} FROM ${table}`).all() as any[];
  const insertMany = dest.transaction((items: any[]) => {
    items.forEach((row) => stmt.run(...columns.map((c) => row[c])));
  });
  insertMany(rows);
}

function migrateLegacyDbIfNeeded() {
  if (!fs.existsSync(LEGACY_DB)) return;
  if (fs.existsSync(MIGRATION_MARKER)) return;

  const usersDb = getUsersDb();
  const studioDb = getStudioDb();

  // Only migrate if target tables are empty
  const shouldMigrateUsers = tableCount(usersDb, "users") === 0;
  const shouldMigrateFollows = tableCount(usersDb, "follows") === 0;
  const shouldMigrateStudio = tableCount(studioDb, "video_tasks") === 0 && tableCount(studioDb, "video_results") === 0;

  if (!shouldMigrateUsers && !shouldMigrateStudio) {
    fs.writeFileSync(MIGRATION_MARKER, new Date().toISOString());
    return;
  }

  const legacy = new Database(LEGACY_DB, { readonly: true });

  if (shouldMigrateUsers) {
    copyTable(legacy, usersDb, "users");
  }
  if (shouldMigrateFollows) {
    copyTable(legacy, usersDb, "follows");
  }

  if (shouldMigrateStudio) {
    copyTable(legacy, studioDb, "video_tasks");
    copyTable(legacy, studioDb, "video_results");
    copyTable(legacy, studioDb, "characters");
  }

  legacy.close();
  fs.writeFileSync(MIGRATION_MARKER, new Date().toISOString());
}

export function initDb() {
  initUsersDb();
  initBlogDb();

  initStudioDb();
  initMessagesDb();
  migrateLegacyDbIfNeeded();
}
