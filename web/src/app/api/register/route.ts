import { createToken, hashPassword } from "@/lib/auth";
import { userRepository } from "@/lib/repositories";
import { getUserByUsername, publicProfile } from "@/lib/user";
import { withErrorHandler } from "@/middleware/error-handler";
import { createdResponse, errorResponses } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";
import { assertAuthPayloadSize, assertAuthRateLimit } from "@/lib/auth-guard";
import { validatePassword } from "@/lib/security";
import { isTurnstileEnabled, verifyTurnstileToken } from "@/lib/captcha";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "用户名至少 3 位")
    .max(30, "用户名最多 30 位")
    .regex(/^[A-Za-z0-9_]+$/, "用户名仅支持英文、数字和下划线"),
  password: z.string().min(8, "密码至少 8 位").max(128, "密码最多 128 位"),
  nickname: z.string().trim().max(50, "昵称最多 50 位").optional(),
  avatar_url: z.string().url("头像 URL 格式不正确").optional().or(z.literal("")),
  cover_url: z.string().url("封面 URL 格式不正确").optional().or(z.literal("")),
  bio: z.string().trim().max(500, "简介最多 500 字").optional(),
  captchaToken: z.string().trim().max(4096).optional(),
});

export const POST = withErrorHandler(async (req) => {
  assertAuthPayloadSize(req);

  const body = await validateBody(req, registerSchema);
  assertAuthRateLimit(req, "register", body.username);

  if (isTurnstileEnabled()) {
    const captchaOk = await verifyTurnstileToken(req, body.captchaToken);
    if (!captchaOk) {
      return errorResponses.badRequest("Captcha verification failed");
    }
  }

  const passwordValidation = validatePassword(body.password);
  if (!passwordValidation.valid) {
    return errorResponses.validation("密码强度不足", { rules: passwordValidation.errors });
  }

  const { username, password, nickname, avatar_url, cover_url, bio } = body;

  if (await userRepository.existsByUsername(username)) {
    return errorResponses.conflict("用户名已存在");
  }

  const normalizedNickname = nickname || username;
  await userRepository.create({
    username,
    password: hashPassword(password),
    nickname: normalizedNickname,
    avatar_url: avatar_url || "",
    cover_url: cover_url || "",
    bio: bio || "",
  });

  const row = await getUserByUsername(username);
  const token = await createToken(username, row?.role || "user");

  const profile =
    (await publicProfile(username, username)) || {
      username,
      role: row?.role || "user",
      nickname: normalizedNickname,
      avatar_url: avatar_url || "",
      cover_url: cover_url || "",
      bio: bio || "",
      created_at: row?.created_at,
      following_count: 0,
      follower_count: 0,
    };

  return createdResponse({ token, profile });
});
