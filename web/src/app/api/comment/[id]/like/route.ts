import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { voteComment } from "@/lib/blog";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const paramsData = await Promise.resolve(params);
    initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });
  voteComment(Number(paramsData.id), user, 1);
  return Response.json({ ok: true });
}
