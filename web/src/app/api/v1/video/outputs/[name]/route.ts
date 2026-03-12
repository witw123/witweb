/**
 * 删除指定的视频输出文件
 *
 * 从服务器上删除指定的本地视频文件
 *
 * @route /api/v1/video/outputs/:name
 * @method DELETE - 删除视频文件
 * @param {string} name - 视频文件名
 * @returns {Promise<Object>} 操作结果 { ok: boolean }
 */
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { deleteVideo } from "@/lib/studio";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

export const DELETE = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const { name } = await context.params;
  await deleteVideo(name);

  return successResponse({ ok: true });
});
