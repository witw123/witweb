/**
 * 获取视频生成历史记录
 *
 * 获取当前用户的所有视频生成历史记录
 *
 * @route /api/v1/video/history
 * @method GET - 获取视频生成历史记录
 * @returns {Promise<Object>} 历史记录列表
 */
import { getAuthUser } from "@/lib/http";
import { getHistory } from "@/lib/studio";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const history = await getHistory();
  return successResponse(history);
});
