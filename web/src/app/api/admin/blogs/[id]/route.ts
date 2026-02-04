import { initDb } from "@/lib/db-init";
import { requireAdminUser } from "@/lib/http";
import { getBlogDetail, updateBlog, deleteBlog } from "@/lib/admin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;
  const blog = getBlogDetail(Number(paramsData.id));
  if (!blog) return Response.json({ detail: "Blog not found" }, { status: 404 });
  return Response.json(blog);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => ({}));
  updateBlog(Number(paramsData.id), body || {});
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;
  deleteBlog(Number(paramsData.id));
  return Response.json({ ok: true });
}
