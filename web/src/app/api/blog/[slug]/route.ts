import { initDb } from "@/lib/db-init";
import { getAuthUser, isAdminUser } from "@/lib/http";
import { getPost, updatePost, deletePost } from "@/lib/blog";
import { successResponse, errorResponses } from "@/lib/api-response";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  slug: z.string().trim().min(1, "slug is required"),
});

const updatePostSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  content: z.string().trim().min(1, "Content is required"),
  tags: z.string().optional().default(""),
  category_id: z.coerce.number().int().positive().optional().or(z.literal("")).or(z.null()),
});

export const GET = withErrorHandler(async (_: Request, { params }: { params: Promise<{ slug: string }> }) => {
  initDb();

  const user = await getAuthUser();
  const { slug } = validateParams(await params, paramsSchema);
  const post = getPost(slug, user || "");
  if (!post) return errorResponses.notFound("Post not found");

  return successResponse(post);
});

export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { slug } = validateParams(await params, paramsSchema);
  const body = await validateBody(req, updatePostSchema);
  const categoryId =
    body.category_id !== undefined &&
    body.category_id !== null &&
    body.category_id !== ""
      ? Number(body.category_id)
      : null;

  const res = updatePost(
    slug,
    body.title,
    body.content,
    body.tags || "",
    user,
    Number.isFinite(categoryId as number) ? categoryId : null,
  );

  if (!res.ok && res.error === "not_found") return errorResponses.notFound("Post not found");
  if (!res.ok) return errorResponses.forbidden("Forbidden");

  return successResponse({ ok: true });
});

export const DELETE = withErrorHandler(async (_: Request, { params }: { params: Promise<{ slug: string }> }) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { slug } = validateParams(await params, paramsSchema);
  const res = deletePost(slug, user, isAdminUser(user));
  if (!res.ok && res.error === "not_found") return errorResponses.notFound("Post not found");
  if (!res.ok) return errorResponses.forbidden("Forbidden");

  return successResponse({ ok: true });
});
