import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { followUser } from "@/lib/follow";

export async function POST(req: Request) {
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const target = (body?.username || "").trim();
  if (!target) return Response.json({ detail: "Missing username" }, { status: 400 });
  followUser(user, target);
  return Response.json({ ok: true });
}
