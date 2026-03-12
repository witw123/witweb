/**
 * PostgreSQL 连接池管理
 *
 * 负责创建和管理 PostgreSQL 数据库连接池，提供健康检查和资源清理功能
 */

import "server-only";
import { Pool, type PoolConfig } from "pg";
import { dbConfig } from "@/lib/config";

let pool: Pool | null = null;

/** PostgreSQL 健康检查状态 */
export interface PostgresHealthStatus {
  /** 是否已配置数据库连接 */
  configured: boolean;
  /** 数据库是否可用 */
  healthy: boolean;
  /** 错误信息（如有） */
  error?: string;
}

/**
 * 检查 PostgreSQL 是否已配置
 *
 * @returns 已配置返回 true，否则返回 false
 */
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

/**
 * 获取 PostgreSQL 连接池
 *
 * 单例模式，确保全局只有一个连接池实例
 *
 * @returns Pool 实例
 */
export function getPostgresPool(): Pool {
  if (pool) return pool;

  pool = new Pool(createPoolConfig());
  return pool;
}

/**
 * 检查 PostgreSQL 数据库健康状态
 *
 * 通过执行简单查询验证数据库连接是否正常
 *
 * @returns 健康状态对象
 */
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

/**
 * 关闭 PostgreSQL 连接池
 *
 * 在应用关闭时调用，释放所有数据库连接资源
 */
export async function closePostgresPool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}
