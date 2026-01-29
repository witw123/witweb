import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { getBlogDetail, updateBlog, deleteBlog } from "@/lib/admin";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const paramsData = await Promise.resolve(params);
    initDb();
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  const blog = getBlogDetail(Number(paramsData.id));
  if (!blog) return Response.json({ detail: "Blog not found" }, { status: 404 });
  return Response.json(blog);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    initDb();
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  updateBlog(Number(paramsData.id), body || {});
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
    initDb();
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  deleteBlog(Number(paramsData.id));
  return Response.json({ ok: true });
}
