/**
 * 视频任务分页工具函数
 *
 * 规范化视频任务查询的分页参数
 */

/** 规范化视频任务分页参数 */
export function normalizeVideoPagination(page = 1, size = 20) {
  const validPage = Math.max(1, page);
  const validSize = Math.max(1, Math.min(50, size));
  const offset = (validPage - 1) * validSize;
  return { page: validPage, size: validSize, offset };
}
