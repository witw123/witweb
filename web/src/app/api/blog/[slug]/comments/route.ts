import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { listComments, addComment } from "@/lib/blog";

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const paramsData = await Promise.resolve(params);
  initDb();
  return Response.json(listComments(paramsData.slug));
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const paramsData = await Promise.resolve(params);
  initDb();
  const body = await req.json().catch(() => ({}));
  const user = await getAuthUser();
  const author = user || body?.author || "访客";
  const content = (body?.content || "").trim();
  if (!content) return Response.json({ detail: "Empty comment" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for") || "";
  const res = addComment(paramsData.slug, author, content, body?.parent_id ?? null, ip);
  if (!res.ok) return Response.json({ detail: "Post not found" }, { status: 404 });
  return Response.json({ ok: true });
}
