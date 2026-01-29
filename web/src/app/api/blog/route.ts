import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { listPosts, createPost } from "@/lib/blog";

export async function GET(req: Request) {
  initDb();
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") || 1);
  const size = Number(url.searchParams.get("size") || 5);
  const q = url.searchParams.get("q") || "";
  const author = url.searchParams.get("author") || "";
  const tag = url.searchParams.get("tag") || "";
  const user = await getAuthUser();
  const data = listPosts(page, size, q, author, tag, user || "");
  return Response.json({
    items: data.items,
    total: data.total,
    page: data.page,
    size: data.size,
  });
}

export async function POST(req: Request) {
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body?.title || !body?.content) {
    return Response.json({ detail: "Title and content required" }, { status: 400 });
  }
  createPost(body.title, body.slug || null, body.content, user, body.tags || "");
  return Response.json({ ok: true, user });
}
