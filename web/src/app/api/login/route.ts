import { initDb } from "@/lib/db-init";
import { createToken, verifyPassword } from "@/lib/auth";
import { getUserByUsername, publicProfile } from "@/lib/user";
import { successResponse, errorResponses } from "@/lib/api-response";

export async function POST(req: Request) {
  initDb();
  const body = await req.json().catch(() => ({}));
  const { username, password } = body || {};
  if (!username || !password) {
    return errorResponses.unauthorized("Invalid credentials");
  }
  const user = getUserByUsername(username);
  if (!user || !verifyPassword(password, user.password)) {
    return errorResponses.unauthorized("Invalid credentials");
  }
  const token = await createToken(username);
  const baseProfile = publicProfile(user.username, user.username) || {
    username: user.username,
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
}
