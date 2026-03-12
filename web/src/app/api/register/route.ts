import { withErrorHandler } from "@/middleware/error-handler";
/**
 * 注册 API（旧版）
 *
 * 处理用户注册请求，已废弃，请使用 /api/v1/auth/register
 *
 * @route /api/register
 * @method POST - 处理用户注册
 */
import { withDeprecation } from "@/lib/deprecation";
import { handleRegisterPost } from "@/app/api/register/shared";

export const POST = withErrorHandler(async (req: Request) => {
  return withDeprecation(await handleRegisterPost(req), "/api/v1/auth/register");
});
