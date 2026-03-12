/**
 * 用户注册 API
 *
 * @route /api/v1/auth/register
 * @method POST - 用户注册
 */

import { withErrorHandler } from "@/middleware/error-handler";
import { handleRegisterPost } from "@/app/api/register/shared";

export const POST = withErrorHandler(async (req: Request) => {
  return handleRegisterPost(req);
});
