import { getAuthUser, isAdminUser } from "@/lib/http";
import { postRepository, userRepository } from "@/lib/repositories";
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

  const user = await getAuthUser();
  const { slug } = validateParams(await params, paramsSchema);
  const post = await postRepository.getPostDetail(slug, user || undefined);
  if (!post) return errorResponses.notFound("Post not found");

  const authorRow = await userRepository.findByUsername(post.author);
  return successResponse({
    ...post,
    author_name: authorRow?.nickname || post.author,
    author_avatar: authorRow?.avatar_url || "",
    tags: post.tags || "",
  });
});

export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {

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

  const existing = await postRepository.findBySlug(slug);
  if (!existing) return errorResponses.notFound("Post not found");
  if (existing.author !== user) return errorResponses.forbidden("Forbidden");

  await postRepository.updateBySlug(slug, {
    title: body.title,
    content: body.content,
    tags: body.tags || "",
    category_id: Number.isFinite(categoryId as number) ? categoryId : null,
  });

  return successResponse({ ok: true });
});

export const DELETE = withErrorHandler(async (_: Request, { params }: { params: Promise<{ slug: string }> }) => {

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { slug } = validateParams(await params, paramsSchema);
  const existing = await postRepository.findBySlug(slug);
  if (!existing) return errorResponses.notFound("Post not found");
  if (existing.author !== user && !isAdminUser(user)) return errorResponses.forbidden("Forbidden");

  await postRepository.hardDelete(slug);
  return successResponse({ ok: true });
});
