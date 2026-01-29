import { initDb } from "@/lib/db-init";
import { createToken, verifyPassword } from "@/lib/auth";
import { getUserByUsername } from "@/lib/user";

export async function POST(req: Request) {
  initDb();
  const body = await req.json().catch(() => ({}));
  const { username, password } = body || {};
  if (!username || !password) {
    return Response.json({ detail: "Invalid credentials" }, { status: 401 });
  }
  const user = getUserByUsername(username);
  if (!user || !verifyPassword(password, user.password)) {
    return Response.json({ detail: "Invalid credentials" }, { status: 401 });
  }
  const token = await createToken(username);
  const profile = {
    username: user.username,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    balance: user.balance ?? 0.0,
  };
  return Response.json({ token, profile });
}
