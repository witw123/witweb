/**
 * 用户资料 API
 *
 * 提供当前登录用户的资料读取和更新能力。
 * 该路由不接受外部用户名参数，只操作当前会话用户，避免前端误改他人资料。
 *
 * @route /api/v1/profile
 * @method GET - 获取当前用户资料
 * @method POST - 更新当前用户资料
 */

import { getAuthUser } from "@/lib/http";
import { userRepository } from "@/lib/repositories";
import { publicProfile } from "@/lib/user";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

/** 资料更新请求体 Schema。 */
const profileSchema = z.object({
  nickname: z.string().trim().min(1).max(50).optional(),
  avatar_url: z.string().trim().optional(),
  cover_url: z.string().trim().optional(),
  bio: z.string().trim().max(500).optional(),
});

/** 获取当前用户公开资料。 */
export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const profile = await publicProfile(user, user);
  return successResponse({ profile });
});

/**
 * 更新当前用户资料
 *
 * 对可选字段统一做默认值折叠，保证用户显式清空资料时也能正确落库。
 */
export const POST = withErrorHandler(async (req: Request) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, profileSchema);
  await userRepository.update(user, {
    nickname: body.nickname || user,
    avatar_url: body.avatar_url || "",
    cover_url: body.cover_url || "",
    bio: body.bio || "",
  });

  const profile = await publicProfile(user, user);
  return successResponse({ profile });
});
