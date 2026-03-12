/**
 * 标签列表 API
 *
 * 获取系统中所有使用的标签及其使用次数
 *
 * @route /api/v1/tags
 * @method GET - 获取标签列表
 */

import { withErrorHandler } from "@/middleware/error-handler";
import { buildTagsResponse } from "../../tags/shared";

/**
 * 获取标签列表
 *
 * 返回所有已使用的标签及其被使用的次数
 *
 * @route GET /api/v1/tags
 * @returns {object} 标签列表及使用次数
 */
export const GET = withErrorHandler(async () => buildTagsResponse());
