import { initDb } from "@/lib/db-init";
import { createToken, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  initDb();
  const body = await req.json().catch(() => ({}));
  const { username, password, nickname, avatar_url } = body || {};
  if (!username || !password) {
    return Response.json({ detail: "Missing credentials" }, { status: 400 });
  }
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    return Response.json({ detail: "Username already exists" }, { status: 409 });
  }
  const nick = nickname || username;
  db.prepare("INSERT INTO users (username, password, nickname, avatar_url) VALUES (?, ?, ?, ?)")
    .run(username, hashPassword(password), nick, avatar_url || "");
  const token = await createToken(username);
  const profile = { username, nickname: nick, avatar_url: avatar_url || "" };
  return Response.json({ token, profile });
}
