import { pgQueryOne } from "@/lib/postgres-query";

export function normalizePagination(page = 1, size = 10) {
  const validPage = Math.max(1, page);
  const validSize = Math.max(1, Math.min(50, size));
  return { page: validPage, size: validSize, offset: (validPage - 1) * validSize };
}

export async function countPosts(where?: string, params: unknown[] = []): Promise<number> {
  const sql = where
    ? `SELECT COUNT(*)::int AS cnt FROM posts WHERE ${where}`
    : "SELECT COUNT(*)::int AS cnt FROM posts";
  return (await pgQueryOne<{ cnt: number }>(sql, params))?.cnt || 0;
}
