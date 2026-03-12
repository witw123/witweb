/**
 * 评论点赞 API
 *
 * 为评论添加点赞（正向投票）
 *
 * @route /api/v1/comments/:id/like
 * @method POST - 点赞评论
 */

import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleCommentRepository } from "@/lib/repositories";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive("评论 ID 必须是正整数"),
});

/**
 * 点赞评论
 *
 * 为指定评论添加点赞投票，正向投票值为 1
 *
 * @route POST /api/v1/comments/:id/like
 * @param {number} id - 评论 ID 路径参数
 * @returns {object} 操作结果
 */
export const POST = withErrorHandler(async (_req, { params }) => {
  const paramsData = await params;

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = validateParams(paramsData, paramsSchema);

  await drizzleCommentRepository.vote(id, user, 1);

  return successResponse({ message: "点赞成功" });
});
