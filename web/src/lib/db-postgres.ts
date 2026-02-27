import "server-only";
import { Pool, type PoolConfig } from "pg";
import { dbConfig } from "@/lib/config";

let pool: Pool | null = null;

export interface PostgresHealthStatus {
  configured: boolean;
  healthy: boolean;
  error?: string;
}

export function isPostgresConfigured(): boolean {
  return !!dbConfig.postgres.url;
}

function createPoolConfig(): PoolConfig {
  if (!dbConfig.postgres.url) {
    throw new Error("DATABASE_URL is not configured");
  }

  return {
    connectionString: dbConfig.postgres.url,
    max: dbConfig.postgres.poolMax,
    idleTimeoutMillis: dbConfig.postgres.idleTimeoutMs,
    connectionTimeoutMillis: dbConfig.postgres.connectionTimeoutMs,
    ssl: dbConfig.postgres.ssl ? { rejectUnauthorized: false } : undefined,
  };
}

export function getPostgresPool(): Pool {
  if (pool) return pool;

  pool = new Pool(createPoolConfig());
  return pool;
}

export async function checkPostgresHealth(): Promise<PostgresHealthStatus> {
  if (!isPostgresConfigured()) {
    return { configured: false, healthy: false, error: "DATABASE_URL is not configured" };
  }

  try {
    const pgPool = getPostgresPool();
    await pgPool.query("SELECT 1");
    return { configured: true, healthy: true };
  } catch (error) {
    return {
      configured: true,
      healthy: false,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

export async function closePostgresPool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}
