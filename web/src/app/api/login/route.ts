import { initDb } from "@/lib/db-init";
import { createToken, verifyPassword } from "@/lib/auth";
import { getUserByUsername, publicProfile } from "@/lib/user";
import { successResponse, errorResponses } from "@/lib/api-response";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";

const loginSchema = z.object({
  username: z.string().trim().min(1, "用户名不能为空"),
  password: z.string().min(1, "密码不能为空"),
});

export const POST = withErrorHandler(async (req: Request) => {
  initDb();

  const body = await validateBody(req, loginSchema);
  const user = getUserByUsername(body.username);
  if (!user || !verifyPassword(body.password, user.password)) {
    return errorResponses.unauthorized("Invalid credentials");
  }

  const token = await createToken(body.username, user.role || "user");
  const baseProfile = publicProfile(user.username, user.username) || {
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
