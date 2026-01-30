import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

type DbKind = "users" | "blog" | "channel" | "studio";

const DB_FILES: Record<DbKind, string> = {
  users: "users.db",
  blog: "blog.db",
  channel: "channel.db",
  studio: "studio.db",
};

const DB_ENVS: Record<DbKind, string> = {
  users: "SORA_USERS_DB_PATH",
  blog: "SORA_BLOG_DB_PATH",
  channel: "SORA_CHANNEL_DB_PATH",
  studio: "SORA_STUDIO_DB_PATH",
};

const instances = new Map<DbKind, any>();

function resolveDbPath(kind: DbKind) {
  const envKey = DB_ENVS[kind];
  const envPath = process.env[envKey];
  if (envPath && envPath.trim()) {
    return envPath.trim();
  }
  return path.resolve(process.cwd(), "..", "data", DB_FILES[kind]);
}

function getDb(kind: DbKind) {
  const existing = instances.get(kind);
  if (existing) return existing;
  const dbPath = resolveDbPath(kind);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  instances.set(kind, db);
  return db;
}

export function getUsersDb() {
  return getDb("users");
}

export function getBlogDb() {
  return getDb("blog");
}

export function getChannelDb() {
  return getDb("channel");
}

export function getStudioDb() {
  return getDb("studio");
}

// Backward-compatible alias (defaults to blog db)
export function getDbLegacy() {
  return getBlogDb();
}
