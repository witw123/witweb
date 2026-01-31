import { initDb } from "@/lib/db-init";
import { getUsersDb } from "@/lib/db";
import { getAuthUser } from "@/lib/http";
import { publicProfile } from "@/lib/user";

export async function POST(req: Request) {
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const nickname = body?.nickname || user;
  const avatarUrl = body?.avatar_url || "";
  const coverUrl = body?.cover_url || "";
  const bio = body?.bio || "";
  const db = getUsersDb();
  db.prepare("UPDATE users SET nickname = ?, avatar_url = ?, cover_url = ?, bio = ? WHERE username = ?")
    .run(nickname, avatarUrl, coverUrl, bio, user);
  const profile = publicProfile(user, user);
  return Response.json({ ok: true, profile });
}
