/**
 * 博客文章仓储共享工具函数
 *
 * 提供文章相关的通用工具函数：
 * - 分页参数规范化
 * - 文章数量统计
 */

import { pgQueryOne } from "@/lib/postgres-query";

/**
 * 规范化分页参数
 *
 * @param page - 请求页码，默认 1
 * @param size - 每页数量，默认 10，最大 50
 * @returns 规范化后的分页参数对象
 */
export function normalizePagination(page = 1, size = 10) {
  const validPage = Math.max(1, page);
  const validSize = Math.max(1, Math.min(50, size));
  return { page: validPage, size: validSize, offset: (validPage - 1) * validSize };
}

/**
 * 统计文章数量
 *
 * @param where - WHERE 子句条件（可选）
 * @param params - 查询参数数组
 * @returns 文章数量
 */
export async function countPosts(where?: string, params: unknown[] = []): Promise<number> {
  const sql = where
    ? `SELECT COUNT(*)::int AS cnt FROM posts WHERE ${where}`
    : "SELECT COUNT(*)::int AS cnt FROM posts";
  return (await pgQueryOne<{ cnt: number }>(sql, params))?.cnt || 0;
}
