import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { updateComment, deleteComment, getPostSlugForComment } from "@/lib/blog";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content = (body?.content || "").trim();
  if (!content) return Response.json({ detail: "Empty content" }, { status: 400 });

  const adminUsername = process.env.ADMIN_USERNAME || "witw";
  const res = updateComment(Number(paramsData.id), content, user, adminUsername);

  if (!res.ok) {
    if (res.error === "not_found") return Response.json({ detail: "Comment not found" }, { status: 404 });
    if (res.error === "forbidden") return Response.json({ detail: "Forbidden" }, { status: 403 });
    return Response.json({ detail: "Update failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });

  const adminUsername = process.env.ADMIN_USERNAME || "witw";
  const res = deleteComment(Number(paramsData.id), user, adminUsername);

  if (!res.ok) {
    if (res.error === "not_found") return Response.json({ detail: "Comment not found" }, { status: 404 });
    if (res.error === "forbidden") return Response.json({ detail: "Forbidden" }, { status: 403 });
    return Response.json({ detail: "Delete failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
