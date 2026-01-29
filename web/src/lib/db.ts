import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let dbInstance: Database.Database | null = null;

function resolveDbPath() {
  const envPath = process.env.SORA_DB_PATH;
  if (envPath && envPath.trim()) {
    return envPath.trim();
  }
  // Default to legacy SQLite location kept from the old api
  return path.resolve(process.cwd(), "..", "data", "blog.db");
}

export function getDb() {
  if (dbInstance) return dbInstance;
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  dbInstance = new Database(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  return dbInstance;
}
