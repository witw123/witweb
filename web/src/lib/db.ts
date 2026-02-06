import "server-only";
import path from "path";
import { dbManager, type DbKind } from "./db-manager";
import type DatabaseType from "better-sqlite3";

/**
 * 
 * 
 * - getUsersDb() / getBlogDb() / getStudioDb() / getMessagesDb()
 */

type LegacyDbKind = "users" | "blog" | "studio" | "messages";

const DB_FILES: Record<LegacyDbKind, string> = {
  users: "users.db",
  blog: "blog.db",
  studio: "studio.db",
  messages: "messages.db",
};

const DB_ENVS: Record<LegacyDbKind, string> = {
  users: "SORA_USERS_DB_PATH",
  blog: "SORA_BLOG_DB_PATH",
  studio: "SORA_STUDIO_DB_PATH",
  messages: "SORA_MESSAGES_DB_PATH",
};

const instances = new Map<LegacyDbKind, DatabaseType>();

/**
 */
export interface DbConnectionStatus {
  kind: DbKind;
  isHealthy: boolean;
  path: string;
  createdAt: Date;
  lastHealthCheck: Date | null;
  queryCount: number;
}

/**
 */
export function getDbConnectionStatus(kind?: DbKind): DbConnectionStatus | DbConnectionStatus[] {
  if (kind) {
    const info = dbManager.getConnectionInfo(kind);
    if (!info) {
      throw new Error(`No connection found for ${kind}`);
    }
    return {
      kind,
      isHealthy: info.isHealthy,
      path: info.path,
      createdAt: info.createdAt,
      lastHealthCheck: info.lastHealthCheck,
      queryCount: info.queryCount,
    };
  }
  
  return dbManager.getAllConnectionStatus().map(status => ({
    kind: status.kind,
    isHealthy: status.isHealthy,
    path: status.path,
    createdAt: status.createdAt,
    lastHealthCheck: status.lastHealthCheck,
    queryCount: status.queryCount,
  }));
}

/**
 */
export function isDbHealthy(kind: DbKind): boolean {
  const info = dbManager.getConnectionInfo(kind);
  return info?.isHealthy ?? false;
}

/**
 */
export async function checkAllDbsHealthy(): Promise<Record<DbKind, boolean>> {
  const results = await dbManager.healthCheck();
  return results.reduce((acc, result) => {
    acc[result.kind] = result.healthy;
    return acc;
  }, {} as Record<DbKind, boolean>);
}

/**
 */
export function checkpointDbs(kind?: DbKind): void {
  if (kind) {
    const db = dbManager.getConnection(kind);
    try {
      db.pragma("wal_checkpoint(PASSIVE)");
    } catch (error) {
      console.error(`[DB] Failed to checkpoint ${kind}:`, error);
    }
  } else {
    dbManager.checkpoint();
  }
}

/**
 */
function getDb(kind: DbKind): DatabaseType {
  const db = dbManager.getConnection(kind);
  instances.set(kind, db);
  return db;
}

/**
 */
export function getUsersDb(): DatabaseType {
  return getDb("users");
}

/**
 */
export function getBlogDb(): DatabaseType {
  return getDb("blog");
}

/**
 */
export function getStudioDb(): DatabaseType {
  return getDb("studio");
}

/**
 */
export function getMessagesDb(): DatabaseType {
  return getDb("messages");
}

/**
 * @internal
 */
export function resolveDbPath(kind: LegacyDbKind): string {
  const envKey = DB_ENVS[kind];
  const envPath = process.env[envKey];
  if (envPath && envPath.trim()) {
    return envPath.trim();
  }
  return path.resolve(process.cwd(), "..", "data", DB_FILES[kind]);
}

/**
 * @internal
 */
export function createDbConnection(kind: LegacyDbKind): DatabaseType {
  console.warn(`[DB] createDbConnection is deprecated, use dbManager.getConnection("${kind}") instead`);
  return dbManager.getConnection(kind);
}

/**
 * @internal
 */
export function getAllDbInstances(): Map<LegacyDbKind, DatabaseType> {
  ["users", "blog", "studio", "messages"].forEach((kind) => {
    const db = dbManager.getConnectionInfo(kind as DbKind);
    if (db && !instances.has(kind as LegacyDbKind)) {
      instances.set(kind as LegacyDbKind, db.instance);
    }
  });
  return instances;
}

/**
 */
export function onDbShutdown(callback: () => void | Promise<void>): () => void {
  return dbManager.onShutdown(callback);
}

/**
 */
export async function closeAllDbs(timeout?: number): Promise<void> {
  return dbManager.shutdown(timeout);
}

/**
 */
export function forceCloseAllDbs(): void {
  return dbManager.forceClose();
}

export { dbManager };
export type { DbKind } from "./db-manager";

const dbApi = {
  getUsersDb,
  getBlogDb,
  getStudioDb,
  getMessagesDb,
  getDbConnectionStatus,
  isDbHealthy,
  checkAllDbsHealthy,
  checkpointDbs,
  dbManager,
};

export default dbApi;
