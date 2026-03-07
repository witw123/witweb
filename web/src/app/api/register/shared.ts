import { createToken, hashPassword } from "@/lib/auth";
import { drizzleUserRepository, userRepository } from "@/lib/repositories";
import { getUserByUsername, publicProfile } from "@/lib/user";
import { createdResponse, errorResponses } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";
import { assertAuthPayloadSize, assertAuthRateLimit } from "@/lib/auth-guard";
import { validatePassword } from "@/lib/security";
import { isTurnstileEnabled, verifyTurnstileToken } from "@/lib/captcha";
import { setAuthCookie } from "@/lib/auth-cookie";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "用户名至少 2 位")
    .max(64, "用户名最多 64 位")
    .regex(/^[A-Za-z0-9_.-]+$/, "用户名仅支持英文、数字、下划线、点和中划线"),
  password: z.string().min(6, "密码至少 6 位").max(256, "密码最多 256 位"),
  nickname: z.string().trim().max(50, "昵称最多 50 位").optional(),
  avatar_url: z.string().url("头像 URL 格式不正确").optional().or(z.literal("")),
  cover_url: z.string().url("封面 URL 格式不正确").optional().or(z.literal("")),
  bio: z.string().trim().max(500, "简介最多 500 字").optional(),
  captchaToken: z.string().trim().max(4096).optional(),
});

export async function handleRegisterPost(req: Request) {
  assertAuthPayloadSize(req);

  const body = await validateBody(req, registerSchema, { message: "注册信息校验失败" });
  assertAuthRateLimit(req, "register", body.username);

  if (isTurnstileEnabled()) {
    if (!body.captchaToken) {
      return errorResponses.badRequest("请先完成人机验证");
    }
    const captchaOk = await verifyTurnstileToken(req, body.captchaToken);
    if (!captchaOk) {
      return errorResponses.badRequest("人机验证未通过，请重试");
    }
  }

  const passwordValidation = validatePassword(body.password);
  if (!passwordValidation.valid) {
    return errorResponses.validation("密码不符合要求", { rules: passwordValidation.errors });
  }

  const { username, password, nickname, avatar_url, cover_url, bio } = body;

  if (await drizzleUserRepository.existsByUsername(username)) {
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

  return setAuthCookie(createdResponse({ token, profile }), token);
}
