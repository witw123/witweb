/**
 * Stats API - 站点统计数据处理
 *
 * 提供获取站点访问统计数据的功能
 * 包括文章总数、总访问量、独立访客数
 */

import { successResponse } from "@/lib/api-response";
import { postRepository } from "@/lib/repositories";

/**
 * 构建站点统计 GET 响应
 *
 * 获取站点的访问统计数据
 *
 * @returns {Promise<Response>} 站点统计数据响应，包含总文章数、总访问量、独立访客数
 */
export async function buildSiteStatsResponse(): Promise<Response> {
  const { totalPosts, totalVisits, totalVisitors } = await postRepository.getSiteStats();

  return successResponse({
    totalPosts,
    totalVisits,
    totalVisitors,
  });
}
