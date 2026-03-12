/**
 * 用户收藏列表 API
 *
 * 复用共享收藏查询逻辑，返回当前用户的收藏文章列表。
 *
 * @route /api/v1/favorites
 * @method GET - 获取用户收藏列表
 */

import { withErrorHandler } from "@/middleware/error-handler";
import { buildFavoritesGetResponse } from "../../favorites/shared";

export const GET = withErrorHandler(async (req: Request) => buildFavoritesGetResponse(req));
