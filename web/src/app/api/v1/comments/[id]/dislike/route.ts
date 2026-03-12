/**
 * 评论点踩 API
 *
 * 为评论添加点踩（负向投票）
 *
 * @route /api/v1/comments/:id/dislike
 * @method POST - 点踩评论
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
 * 点踩评论
 *
 * 为指定评论添加点踩投票，负向投票值为 -1
 *
 * @route POST /api/v1/comments/:id/dislike
 * @param {number} id - 评论 ID 路径参数
 * @returns {object} 操作结果
 */
export const POST = withErrorHandler(async (_req, { params }) => {
  const paramsData = await params;

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = validateParams(paramsData, paramsSchema);

  await drizzleCommentRepository.vote(id, user, -1);

  return successResponse({ message: "点踩成功" });
});
