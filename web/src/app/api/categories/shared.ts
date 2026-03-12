/**
 * Categories API - 分类数据处理
 *
 * 提供获取所有文章分类的功能
 * 返回所有启用的分类列表
 */

import { successResponse } from "@/lib/api-response";
import { drizzleCategoryRepository } from "@/lib/repositories/category-repository.drizzle";

/**
 * 构建分类列表 GET 响应
 *
 * 获取所有已启用的文章分类
 *
 * @returns {Promise<Response>} 分类列表响应
 */
export async function buildCategoriesResponse(): Promise<Response> {
  const categories = await drizzleCategoryRepository.listCategories(false);
  return successResponse({ items: categories });
}
