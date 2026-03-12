/**
 * 关注用户 API
 *
 * 允许当前登录用户发起关注动作。
 * 路由层会显式阻止“关注自己”的无效操作，避免把这类输入下放到仓储层变成无意义写入。
 *
 * @route /api/v1/follow
 * @method POST - 关注用户
 */

import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleUserRepository } from "@/lib/repositories";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";

/** 关注请求体 Schema。 */
const followSchema = z.object({
  username: z.string().trim().min(1, "用户名不能为空"),
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, followSchema);
  if (user !== body.username) {
    await drizzleUserRepository.follow(user, body.username);
  }

  return successResponse({ ok: true });
});
