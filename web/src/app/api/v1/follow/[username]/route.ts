/**
 * 取消关注用户 API
 *
 * 取消对指定用户的关注关系
 *
 * @route /api/v1/follow/:username
 * @method DELETE - 取消关注用户
 */

import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleUserRepository } from "@/lib/repositories";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  username: z.string().trim().min(1, "用户名不能为空"),
});

/**
 * 取消关注用户
 *
 * 当前登录用户取消关注指定用户
 *
 * @route DELETE /api/v1/follow/:username
 * @param {string} username - 被取消关注的目标用户名
 * @returns {object} 操作结果
 */
export const DELETE = withErrorHandler(
  async (_: Request, { params }: { params: Promise<{ username: string }> }) => {
    const user = await getAuthUser();
    assertAuthenticated(user);

    const parsed = validateParams(await params, paramsSchema);
    await drizzleUserRepository.unfollow(user, parsed.username);

    return successResponse({ ok: true });
  }
);
