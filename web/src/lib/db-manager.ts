import "server-only";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type DatabaseType from "better-sqlite3";

/**
 * 
 */

export type DbKind = "users" | "blog" | "studio" | "messages";

interface DbConnection {
  instance: DatabaseType;
  path: string;
  createdAt: Date;
  lastHealthCheck: Date | null;
  queryCount: number;
  isHealthy: boolean;
}

interface DbManagerOptions {
  walCheckpointInterval?: number;
  healthCheckInterval?: number;
  verbose?: boolean;
  timeout?: number;
  walMode?: boolean;
}

const DB_FILES: Record<DbKind, string> = {
  users: "users.db",
  blog: "blog.db",
  studio: "studio.db",
  messages: "messages.db",
};

const DB_ENVS: Record<DbKind, string> = {
  users: "SORA_USERS_DB_PATH",
  blog: "SORA_BLOG_DB_PATH",
  studio: "SORA_STUDIO_DB_PATH",
  messages: "SORA_MESSAGES_DB_PATH",
};

const DEFAULT_OPTIONS: Required<DbManagerOptions> = {
  walCheckpointInterval: 60000,
  healthCheckInterval: 30000,
  verbose: process.env.NODE_ENV !== "production",
  timeout: 5000,
  walMode: true,
};

class DatabaseManager {
  private connections = new Map<DbKind, DbConnection>();
  private options: Required<DbManagerOptions>;
  private walInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private shutdownCallbacks: Array<() => void | Promise<void>> = [];

  constructor(options: DbManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.setupGracefulShutdown();
  }

  /**
   */
  getConnection(kind: DbKind): DatabaseType {
    if (this.isShuttingDown) {
      throw new Error(`[DB Manager] Cannot get ${kind} database: manager is shutting down`);
    }

    const existing = this.connections.get(kind);
    if (existing && existing.isHealthy) {
      return existing.instance;
    }

    return this.createConnection(kind);
  }

  /**
   */
  getConnectionInfo(kind: DbKind): DbConnection | undefined {
    return this.connections.get(kind);
  }

  /**
   */
  getAllConnectionStatus(): Array<{
    kind: DbKind;
    path: string;
    isHealthy: boolean;
    createdAt: Date;
    lastHealthCheck: Date | null;
    queryCount: number;
  }> {
    return Array.from(this.connections.entries()).map(([kind, conn]) => ({
      kind,
      path: conn.path,
      isHealthy: conn.isHealthy,
      createdAt: conn.createdAt,
      lastHealthCheck: conn.lastHealthCheck,
      queryCount: conn.queryCount,
    }));
  }

  /**
   */
  async healthCheck(): Promise<Array<{ kind: DbKind; healthy: boolean; error?: string }>> {
    const results: Array<{ kind: DbKind; healthy: boolean; error?: string }> = [];

    for (const [kind, conn] of this.connections) {
      try {
        conn.instance.prepare("SELECT 1").get();
        conn.lastHealthCheck = new Date();
        conn.isHealthy = true;
        results.push({ kind, healthy: true });
      } catch (error) {
        conn.isHealthy = false;
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ kind, healthy: false, error: errorMsg });
        this.log("error", `Health check failed for ${kind}:`, errorMsg);
      }
    }

    return results;
  }

  /**
   */
  private createConnection(kind: DbKind): DatabaseType {
    const dbPath = this.resolveDbPath(kind);
    
    this.log("info", `Initializing ${kind} database at: ${dbPath}`);

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new Database(dbPath, {
      timeout: this.options.timeout,
      verbose: this.options.verbose ? (sql: string) => this.log("debug", `[SQL] ${sql}`) : undefined,
    });

    if (this.options.walMode) {
      db.pragma("journal_mode = WAL");
      db.pragma("wal_autocheckpoint = 1000");
    }
    
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");

    const connection: DbConnection = {
      instance: db,
      path: dbPath,
      createdAt: new Date(),
      lastHealthCheck: new Date(),
      queryCount: 0,
      isHealthy: true,
    };

    this.connections.set(kind, connection);

    const originalPrepare = db.prepare.bind(db);
    db.prepare = (sql: string) => {
      connection.queryCount++;
      return originalPrepare(sql);
    };

    return db;
  }

  /**
   */
  private resolveDbPath(kind: DbKind): string {
    const envKey = DB_ENVS[kind];
    const envPath = process.env[envKey];
    if (envPath && envPath.trim()) {
      return envPath.trim();
    }
    return path.resolve(process.cwd(), "..", "data", DB_FILES[kind]);
  }

  /**
   */
  checkpoint(): Array<{ kind: DbKind; success: boolean; error?: string }> {
    const results: Array<{ kind: DbKind; success: boolean; error?: string }> = [];

    for (const [kind, conn] of this.connections) {
      try {
        const result = conn.instance.pragma("wal_checkpoint(PASSIVE)") as Array<{ busy: number; log: number; checkpointed: number }>;
        this.log("debug", `WAL checkpoint for ${kind}:`, result?.[0]);
        results.push({ kind, success: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.log("error", `WAL checkpoint failed for ${kind}:`, errorMsg);
        results.push({ kind, success: false, error: errorMsg });
      }
    }

    return results;
  }

  /**
   */
  onShutdown(callback: () => void | Promise<void>): () => void {
    this.shutdownCallbacks.push(callback);
    return () => {
      const index = this.shutdownCallbacks.indexOf(callback);
      if (index > -1) {
        this.shutdownCallbacks.splice(index, 1);
      }
    };
  }

  /**
   */
  async shutdown(timeout = 10000): Promise<void> {
    if (this.isShuttingDown) {
      this.log("warn", "Shutdown already in progress");
      return;
    }

    this.isShuttingDown = true;
    this.log("info", "Starting database manager shutdown...");

    if (this.walInterval) {
      clearInterval(this.walInterval);
      this.walInterval = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    const callbackTimeout = new Promise<void>((_, reject) => 
      setTimeout(() => reject(new Error("Shutdown callbacks timeout")), timeout)
    );

    try {
      await Promise.race([
        Promise.all(this.shutdownCallbacks.map(cb => cb())),
        callbackTimeout,
      ]);
    } catch (error) {
      this.log("error", "Shutdown callbacks error:", error);
    }

    this.checkpoint();

    const closePromises = Array.from(this.connections.entries()).map(async ([kind, conn]) => {
      try {
        conn.instance.close();
        this.log("info", `Closed ${kind} database connection`);
      } catch (error) {
        this.log("error", `Error closing ${kind} database:`, error);
      }
    });

    await Promise.all(closePromises);
    this.connections.clear();
    this.log("info", "Database manager shutdown complete");
  }

  /**
   */
  forceClose(): void {
    this.isShuttingDown = true;
    
    if (this.walInterval) {
      clearInterval(this.walInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    for (const [, conn] of this.connections) {
      try {
        conn.instance.close();
      } catch {
      }
    }
    this.connections.clear();
  }

  /**
   */
  startBackgroundTasks(): void {
    if (this.options.walCheckpointInterval > 0) {
      this.walInterval = setInterval(() => {
        this.checkpoint();
      }, this.options.walCheckpointInterval);
    }

    if (this.options.healthCheckInterval > 0) {
      this.healthCheckInterval = setInterval(() => {
        this.healthCheck().catch(err => {
          this.log("error", "Background health check failed:", err);
        });
      }, this.options.healthCheckInterval);
    }
  }

  /**
   */
  private setupGracefulShutdown(): void {
    const handleShutdown = async (signal: string) => {
      this.log("info", `Received ${signal}, starting graceful shutdown...`);
      try {
        await this.shutdown(10000);
        process.exit(0);
      } catch (error) {
        this.log("error", "Graceful shutdown failed:", error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));
    
    if (process.platform === "win32") {
      process.on("exit", () => {
        this.forceClose();
      });
    }
  }

  /**
   */
  private log(level: "info" | "debug" | "warn" | "error", ...args: unknown[]): void {
    if (!this.options.verbose && level === "debug") {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [DB Manager] [${level.toUpperCase()}]`;
    
    switch (level) {
      case "error":
        console.error(prefix, ...args);
        break;
      case "warn":
        console.warn(prefix, ...args);
        break;
      default:
        console.log(prefix, ...args);
    }
  }
}

export const dbManager = new DatabaseManager({
  verbose: process.env.NODE_ENV !== "production",
});

dbManager.startBackgroundTasks();

export type { DatabaseType, DbConnection, DbManagerOptions };
