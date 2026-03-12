/**
 * 分类列表 API
 *
 * 作为版本化分类读取入口，直接复用共享分类查询响应。
 *
 * @route /api/v1/categories
 * @method GET - 获取分类列表
 */

import { withErrorHandler } from "@/middleware/error-handler";
import { buildCategoriesResponse } from "../../categories/shared";

export const GET = withErrorHandler(async () => buildCategoriesResponse());
