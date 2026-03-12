/**
 * 获取当前活跃的视频生成任务
 *
 * 获取当前用户正在进行的视频生成任务列表
 *
 * @route /api/v1/video/active
 * @method GET - 获取活跃任务列表
 * @returns {Promise<Object>} 活跃任务列表
 */
import { getAuthUser } from "@/lib/http";
import { getActiveTasks } from "@/lib/studio";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const tasks = await getActiveTasks();
  return successResponse(tasks);
});
