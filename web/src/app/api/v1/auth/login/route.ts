/**
 * 用户登录 API
 *
 * 作为版本化登录入口，实际逻辑复用老的共享处理器，确保 `/api/login` 和 `/api/v1/auth/login`
 * 行为一致。
 *
 * @route /api/v1/auth/login
 * @method POST - 用户登录
 */

import { withErrorHandler } from "@/middleware/error-handler";
import { handleLoginPost } from "@/app/api/login/shared";

export const POST = withErrorHandler(async (req: Request) => {
  return handleLoginPost(req);
});
