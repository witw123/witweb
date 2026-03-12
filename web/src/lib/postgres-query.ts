/**
 * PostgreSQL 原始查询工具
 *
 * 提供底层 SQL 查询接口，支持参数化查询、事务处理和占位符转换
 * 注意：优先使用 Drizzle ORM，此工具仅用于需要直接操作 SQL 的场景
 */

import "server-only";
import type { PoolClient, QueryResultRow } from "pg";
import { getPostgresPool } from "@/lib/db-postgres";

type PgExecutor = {
  query<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
};

function toPgPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

function getExecutor(client?: PoolClient): PgExecutor {
  if (client) return client;
  return getPostgresPool();
}

/**
 * 执行 PostgreSQL 查询（返回多行）
 *
 * 将 `?` 占位符转换为 `$1, $2` 等形式，支持事务内的查询
 *
 * @param sql - SQL 语句，使用 `?` 作为参数占位符
 * @param params - 参数数组
 * @param client - 可选的数据库客户端（用于事务）
 * @returns 查询结果数组
 */
export async function pgQuery<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  client?: PoolClient
): Promise<T[]> {
  const executor = getExecutor(client);
  const result = await executor.query<T>(toPgPlaceholders(sql), params);
  return result.rows;
}

/**
 * 执行 PostgreSQL 查询（返回单行）
 *
 * @param sql - SQL 语句
 * @param params - 参数数组
 * @param client - 可选的数据库客户端
 * @returns 单行结果或 null
 */
export async function pgQueryOne<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  client?: PoolClient
): Promise<T | null> {
  const rows = await pgQuery<T>(sql, params, client);
  return rows[0] ?? null;
}

/**
 * 执行 PostgreSQL 更新/删除操作
 *
 * 用于 INSERT、UPDATE、DELETE 语句，返回受影响的行数
 *
 * @param sql - SQL 语句
 * @param params - 参数数组
 * @param client - 可选的数据库客户端
 * @returns 受影响的行数
 */
export async function pgRun(
  sql: string,
  params: unknown[] = [],
  client?: PoolClient
): Promise<{ changes: number }> {
  const executor = getExecutor(client);
  const result = await executor.query(toPgPlaceholders(sql), params);
  return { changes: result.rowCount ?? 0 };
}

/**
 * 在 PostgreSQL 事务中执行回调
 *
 * 自动处理 BEGIN、COMMIT 和 ROLLBACK，异常时会自动回滚
 *
 * @param callback - 接收数据库客户端的回调函数
 * @returns 回调的返回值
 * @throws 回滚时抛出原始错误
 */
export async function withPgTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
