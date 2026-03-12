/**
 * Radar 主题删除 API
 *
 * 删除用户保存的指定 Radar 主题
 *
 * @route /api/v1/radar/topics/:id
 * @method DELETE - 删除指定主题
 * @requiresAuth 需要用户认证
 */
import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { deleteRadarSavedTopic } from "@/lib/topic-radar";

export const DELETE = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  const topicId = Number(id);

  try {
    const result = await deleteRadarSavedTopic(topicId, user);
    return successResponse(result);
  } catch {
    return errorResponses.notFound("topic_not_found");
  }
});
