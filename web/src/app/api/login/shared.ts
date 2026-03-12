/**
 * Login API - 用户登录数据处理
 *
 * 提供用户登录功能
 * 验证用户名密码、验证码（如果启用），生成认证令牌
 * 支持普通登录和管理员登录两种模式
 */

import { createToken, verifyPassword } from "@/lib/auth";
import { getUserByUsername, publicProfile } from "@/lib/user";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";
import { assertAuthPayloadSize, assertAuthRateLimit, delayFailedAuth } from "@/lib/auth-guard";
import { isTurnstileEnabled, verifyTurnstileToken } from "@/lib/captcha";
import { authConfig } from "@/lib/config";
import { setAuthCookie } from "@/lib/auth-cookie";
import { hasAdminAccess, normalizeRole } from "@/lib/rbac";

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "用户名不能为空")
    .max(64, "用户名最多 64 位"),
  password: z.string().min(1, "密码不能为空").max(256, "密码最多 256 位"),
  captchaToken: z.string().trim().max(4096).optional(),
  adminOnly: z.boolean().optional().default(false),
});

/**
 * 处理用户登录 POST 请求
 *
 * 验证用户凭据和验证码（如果启用），返回 JWT 令牌和用户信息
 * 包含登录速率限制和失败延迟，防止暴力破解
 *
 * @param {Request} req - HTTP 请求对象，包含 username、password、captchaToken 等
 * @returns {Promise<Response>} 登录结果响应，包含令牌和用户资料
 */
export async function handleLoginPost(req: Request) {
  assertAuthPayloadSize(req);

  const body = await validateBody(req, loginSchema, { message: "登录信息校验失败" });
  assertAuthRateLimit(req, "login", body.username);

  if (isTurnstileEnabled()) {
    if (!body.captchaToken) {
      await delayFailedAuth();
      return errorResponses.badRequest("请先完成人机验证");
    }
    const captchaOk = await verifyTurnstileToken(req, body.captchaToken);
    if (!captchaOk) {
      await delayFailedAuth();
      return errorResponses.badRequest("人机验证未通过，请重试");
    }
  }

  const user = await getUserByUsername(body.username);
  if (!user || !verifyPassword(body.password, user.password)) {
    await delayFailedAuth();
    return errorResponses.unauthorized("账号或密码错误");
  }

  const normalizedRole = normalizeRole(user.role, user.username === authConfig.adminUsername);
  if (body.adminOnly && !hasAdminAccess(normalizedRole)) {
    await delayFailedAuth();
    return errorResponses.forbidden("当前账号无后台登录权限");
  }

  const token = await createToken(body.username, normalizedRole);
  const baseProfile = (await publicProfile(user.username, user.username)) || {
    username: user.username,
    role: normalizedRole,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    cover_url: user.cover_url || "",
    bio: user.bio || "",
    created_at: user.created_at,
    following_count: 0,
    follower_count: 0,
  };

  const profile = {
    ...baseProfile,
    role: normalizedRole,
    balance: user.balance ?? 0.0,
  };

  return setAuthCookie(successResponse({ token, profile }), token);
}
