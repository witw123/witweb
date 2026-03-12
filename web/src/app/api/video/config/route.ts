/**
 * 视频配置管理 API
 *
 * 管理员获取和更新视频服务的配置参数
 *
 * 需要管理员权限
 *
 * @route /api/video/config
 * @method GET - 获取视频配置
 * @method POST - 更新视频配置
 */
import { withErrorHandler } from "@/middleware/error-handler";
import { getVideoConfigHandler, updateVideoConfigHandler } from "./shared";

export const GET = withErrorHandler(async () => getVideoConfigHandler());
export const POST = withErrorHandler(async (req) => updateVideoConfigHandler(req));
