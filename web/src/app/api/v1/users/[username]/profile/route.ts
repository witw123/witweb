/**
 * 用户公开资料 API
 *
 * 获取指定用户的公开资料信息，包括基本信息、统计数等
 *
 * @route /api/v1/users/:username/profile
 * @method GET - 获取用户公开资料
 */

import { publicProfile } from "@/lib/user";
import { getAuthUser } from "@/lib/http";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  username: z.string().trim().min(1, "username is required"),
});

/**
 * 获取用户公开资料
 *
 * 返回指定用户的公开资料，包含头像、昵称、简介、关注数、粉丝数、文章数等
 * 同时返回当前登录用户与目标用户的关注关系
 *
 * @route GET /api/v1/users/:username/profile
 * @param {string} username - 用户名路径参数
 * @returns {object} 用户公开资料
 */
export const GET = withErrorHandler(async (_: Request, { params }: { params: Promise<{ username: string }> }) => {
  const viewer = await getAuthUser();
  const { username } = validateParams(await params, paramsSchema);

  const profile = await publicProfile(username, viewer || undefined);
  if (!profile) return errorResponses.notFound("User not found");

  return successResponse(profile);
});
