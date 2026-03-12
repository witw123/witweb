/**
 * 用户动态 API
 *
 * 获取指定用户的文章动态列表（发布过的文章）
 *
 * @route /api/v1/users/:username/activity
 * @method GET - 获取用户动态列表
 */

import { successResponse, errorResponses } from "@/lib/api-response";
import { drizzlePostRepository } from "@/lib/repositories";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateParams, validateQuery, z } from "@/lib/validate";

const paramsSchema = z.object({
  username: z.string().trim().min(1, "username is required"),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(10),
});

/**
 * 获取用户动态列表
 *
 * 返回指定用户发布的所有文章，按发布时间倒序排列
 *
 * @route GET /api/v1/users/:username/activity
 * @param {string} username - 用户名路径参数
 * @param {number} [page=1] - 分页页码
 * @param {number} [size=10] - 每页数量（最大100）
 * @returns {object} 文章列表和总数
 */
export const GET = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) => {
  const { username } = validateParams(await params, paramsSchema);
  if (!username) return errorResponses.badRequest("Invalid username");

  const { page, size } = await validateQuery(request, querySchema);
  const data = await drizzlePostRepository.getActivities(username, page, size);

  return successResponse({ items: data.items, total: data.total });
});
