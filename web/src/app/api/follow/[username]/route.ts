import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { unfollowUser } from "@/lib/follow";

export async function DELETE(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });
  const target = (paramsData.username || "").trim();
  if (!target) return Response.json({ detail: "Missing username" }, { status: 400 });
  unfollowUser(user, target);
  return Response.json({ ok: true });
}
