/**
 * 关于页面内容 API
 *
 * 提供关于页 Markdown 内容的读取与更新入口。
 * 读取为公开能力，更新则由共享处理器在内部完成管理员权限校验。
 *
 * @route /api/v1/about
 * @method GET - 获取关于页面内容
 * @method PUT - 更新关于页面内容
 */
import { withErrorHandler } from "@/middleware/error-handler";
import { buildAboutGetResponse, buildAboutPutResponse } from "../../about/shared";

export const GET = withErrorHandler(async () => buildAboutGetResponse());
export const PUT = withErrorHandler(async (req: Request) => buildAboutPutResponse(req));
