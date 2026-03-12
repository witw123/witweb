/**
 * 用户粉丝列表 API
 *
 * 获取指定用户或当前用户的粉丝列表，支持分页和关键字搜索。
 *
 * @route /api/v1/followers
 * @method GET - 获取粉丝列表
 */

import { NextRequest } from "next/server";
import { errorResponses, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleUserRepository } from "@/lib/repositories";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateQuery, z } from "@/lib/validate";

/** 查询参数 Schema。 */
const querySchema = z.object({
  username: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional().default(""),
});

/**
 * 获取粉丝列表
 *
 * 如果不显式传入 `username`，默认返回当前登录用户的粉丝。
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  const { username, page, size, q } = await validateQuery(req, querySchema);
  const targetUsername = username || user;
  const result = await drizzleUserRepository.listFollowers(
    targetUsername,
    page,
    size,
    q,
    user
  );

  return successResponse(result);
});
