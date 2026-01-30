import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { voteComment } from "@/lib/blog";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });
  voteComment(Number(paramsData.id), user, 1);
  return Response.json({ ok: true });
}
