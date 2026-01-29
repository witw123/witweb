import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { getPost, updatePost, deletePost } from "@/lib/blog";

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const paramsData = await Promise.resolve(params);
    initDb();
  const slug = paramsData.slug;
  const user = await getAuthUser();
  const post = getPost(slug, user || "");
  if (!post) return Response.json({ detail: "Post not found" }, { status: 404 });
  return Response.json(post);
}

export async function PUT(req: Request, { params }: { params: { slug: string } }) {
    initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body?.title || !body?.content) {
    return Response.json({ detail: "Title and content required" }, { status: 400 });
  }
  const res = updatePost(paramsData.slug, body.title, body.content, body.tags || "", user);
  if (!res.ok && res.error === "not_found") {
    return Response.json({ detail: "Post not found" }, { status: 404 });
  }
  if (!res.ok) return Response.json({ detail: "Forbidden" }, { status: 403 });
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { slug: string } }) {
    initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });
  const admin = process.env.ADMIN_USERNAME || "witw";
  const res = deletePost(paramsData.slug, user, admin);
  if (!res.ok && res.error === "not_found") {
    return Response.json({ detail: "Post not found" }, { status: 404 });
  }
  if (!res.ok) return Response.json({ detail: "Forbidden" }, { status: 403 });
  return Response.json({ ok: true });
}
