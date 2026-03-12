/**
 * 获取本地视频输出列表
 *
 * 获取服务器上已生成的视频文件列表
 *
 * @route /api/v1/video/outputs
 * @method GET - 获取视频输出列表
 * @returns {Promise<Object>} 视频文件列表
 */
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { getLocalVideos } from "@/lib/studio";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const videos = await getLocalVideos();
  return successResponse(videos);
});
