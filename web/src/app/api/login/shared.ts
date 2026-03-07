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
