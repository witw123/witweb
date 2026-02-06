import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { getPost, updatePost, deletePost } from "@/lib/blog";
import { successResponse, errorResponses } from "@/lib/api-response";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const paramsData = await params;
  initDb();
  const slug = paramsData.slug;
  const user = await getAuthUser();
  const post = getPost(slug, user || "");
  if (!post) return errorResponses.notFound("Post not found");
  return successResponse(post);
}

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await getAuthUser();
  if (!user) return errorResponses.unauthorized("Missing token");
  const body = await req.json().catch(() => ({}));
  if (!body?.title || !body?.content) {
    return errorResponses.badRequest("Title and content required");
  }
  const categoryId = body?.category_id !== undefined && body?.category_id !== null && body?.category_id !== ""
    ? Number(body.category_id)
    : null;
  const res = updatePost(
    paramsData.slug,
    body.title,
    body.content,
    body.tags || "",
    user,
    Number.isFinite(categoryId as number) ? categoryId : null,
  );
  if (!res.ok && res.error === "not_found") {
    return errorResponses.notFound("Post not found");
  }
  if (!res.ok) return errorResponses.forbidden("Forbidden");
  return successResponse({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await getAuthUser();
  if (!user) return errorResponses.unauthorized("Missing token");
  const admin = process.env.ADMIN_USERNAME || "witw";
  const res = deletePost(paramsData.slug, user, admin);
  if (!res.ok && res.error === "not_found") {
    return errorResponses.notFound("Post not found");
  }
  if (!res.ok) return errorResponses.forbidden("Forbidden");
  return successResponse({ ok: true });
}
