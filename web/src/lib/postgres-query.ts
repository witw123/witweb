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

export async function pgQuery<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  client?: PoolClient
): Promise<T[]> {
  const executor = getExecutor(client);
  const result = await executor.query<T>(toPgPlaceholders(sql), params);
  return result.rows;
}

export async function pgQueryOne<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  client?: PoolClient
): Promise<T | null> {
  const rows = await pgQuery<T>(sql, params, client);
  return rows[0] ?? null;
}

export async function pgRun(
  sql: string,
  params: unknown[] = [],
  client?: PoolClient
): Promise<{ changes: number }> {
  const executor = getExecutor(client);
  const result = await executor.query(toPgPlaceholders(sql), params);
  return { changes: result.rowCount ?? 0 };
}

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
