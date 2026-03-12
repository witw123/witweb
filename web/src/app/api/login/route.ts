/**
 * 登录 API（旧版）
 *
 * 处理用户登录请求，已废弃，请使用 /api/v1/auth/login
 *
 * @route /api/login
 * @method POST - 处理用户登录
 */
import { withErrorHandler } from "@/middleware/error-handler";
import { withDeprecation } from "@/lib/deprecation";
import { handleLoginPost } from "@/app/api/login/shared";

export const POST = withErrorHandler(async (req: Request) => {
  return withDeprecation(await handleLoginPost(req), "/api/v1/auth/login");
});
