import { initDb } from "@/lib/db-init";
import { createToken, hashPassword } from "@/lib/auth";
import { userRepository } from "@/lib/repositories";
import { getUserByUsername, publicProfile } from "@/lib/user";
import { withErrorHandler } from "@/middleware/error-handler";
import { createdResponse, errorResponses } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "用户名不能为空")
    .min(2, "用户名至少 2 位")
    .max(30, "用户名最多 30 位")
    .regex(/^[A-Za-z0-9_]+$/, "用户名仅支持英文、数字和下划线"),
  password: z.string().min(1, "密码不能为空").min(6, "密码至少 6 位"),
  nickname: z.string().trim().max(50, "昵称最多 50 位").optional(),
  avatar_url: z.string().url("头像 URL 格式不正确").optional().or(z.literal("")),
  cover_url: z.string().url("封面 URL 格式不正确").optional().or(z.literal("")),
  bio: z.string().trim().max(500, "简介最多 500 字").optional(),
});

export const POST = withErrorHandler(async (req) => {
  initDb();

  const body = await validateBody(req, registerSchema);
  const { username, password, nickname, avatar_url, cover_url, bio } = body;

  if (userRepository.existsByUsername(username)) {
    return errorResponses.conflict("用户名已存在");
  }

  const normalizedNickname = nickname || username;
  userRepository.create({
    username,
    password: hashPassword(password),
    nickname: normalizedNickname,
    avatar_url: avatar_url || "",
    cover_url: cover_url || "",
    bio: bio || "",
  });

  const row = getUserByUsername(username);
  const token = await createToken(username, row?.role || "user");

  const profile =
    publicProfile(username, username) || {
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
