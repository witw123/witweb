import { createToken, verifyPassword } from "@/lib/auth";
import { getUserByUsername, publicProfile } from "@/lib/user";
import { successResponse, errorResponses } from "@/lib/api-response";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { assertAuthPayloadSize, assertAuthRateLimit, delayFailedAuth } from "@/lib/auth-guard";
import { isTurnstileEnabled, verifyTurnstileToken } from "@/lib/captcha";

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "用户名不能为空")
    .max(64, "用户名最多 64 位"),
  password: z.string().min(1, "密码不能为空").max(128, "密码最多 128 位"),
  captchaToken: z.string().trim().max(4096).optional(),
});

export const POST = withErrorHandler(async (req: Request) => {
  assertAuthPayloadSize(req);

  const body = await validateBody(req, loginSchema);
  assertAuthRateLimit(req, "login", body.username);

  if (isTurnstileEnabled()) {
    const captchaOk = await verifyTurnstileToken(req, body.captchaToken);
    if (!captchaOk) {
      await delayFailedAuth();
      return errorResponses.badRequest("Captcha verification failed");
    }
  }

  const user = await getUserByUsername(body.username);
  if (!user || !verifyPassword(body.password, user.password)) {
    await delayFailedAuth();
    return errorResponses.unauthorized("Invalid credentials");
  }

  const token = await createToken(body.username, user.role || "user");
  const baseProfile = (await publicProfile(user.username, user.username)) || {
    username: user.username,
    role: user.role || "user",
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
    balance: user.balance ?? 0.0,
  };

  return successResponse({ token, profile });
});
