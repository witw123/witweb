import { initDb } from "@/lib/db-init";
import { createToken, hashPassword } from "@/lib/auth";
import { getUsersDb } from "@/lib/db";
import { getUserByUsername, publicProfile } from "@/lib/user";

export async function POST(req: Request) {
  initDb();
  const body = await req.json().catch(() => ({}));
  const { username, password, nickname, avatar_url, cover_url, bio } = body || {};
  if (!username || !password) {
    return Response.json({ detail: "Missing credentials" }, { status: 400 });
  }
  const db = getUsersDb();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    return Response.json({ detail: "Username already exists" }, { status: 409 });
  }
  const nick = nickname || username;
  db.prepare("INSERT INTO users (username, password, nickname, avatar_url, cover_url, bio) VALUES (?, ?, ?, ?, ?, ?)")
    .run(username, hashPassword(password), nick, avatar_url || "", cover_url || "", bio || "");
  const token = await createToken(username);
  const row = getUserByUsername(username);
  const baseProfile = publicProfile(username, username) || {
    username,
    nickname: nick,
    avatar_url: avatar_url || "",
    cover_url: cover_url || "",
    bio: bio || "",
    created_at: row?.created_at,
    following_count: 0,
    follower_count: 0,
  };
  return Response.json({ token, profile: baseProfile });
}
