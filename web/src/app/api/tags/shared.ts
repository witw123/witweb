/**
 * Tags API - 标签数据处理
 *
 * 提供获取所有标签及其统计数据的功能
 * 返回每个标签关联的文章数量
 */

import { successResponse } from "@/lib/api-response";
import { postRepository } from "@/lib/repositories";

/**
 * 构建标签列表 GET 响应
 *
 * 获取所有标签及其使用统计，按使用次数降序排列
 *
 * @returns {Promise<Response>} 标签列表响应，包含标签数组和总数
 */
export async function buildTagsResponse(): Promise<Response> {
  const tagList = await postRepository.listTagStats();
  return successResponse({
    tags: tagList,
    total: tagList.length,
  });
}
