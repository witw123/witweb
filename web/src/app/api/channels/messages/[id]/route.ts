import { initDb } from "@/lib/db-init";
import { deleteMessage } from "@/lib/channel";
import { getAuthUser } from "@/lib/http";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Not authenticated" }, { status: 401 });
  const res = deleteMessage(Number(paramsData.id), user);
  if (!res.ok && res.error === "not_found") return Response.json({ detail: "Message not found" }, { status: 404 });
  if (!res.ok) return Response.json({ detail: "Not authorized" }, { status: 403 });
  return Response.json({ ok: true, message: "Message deleted" });
}
