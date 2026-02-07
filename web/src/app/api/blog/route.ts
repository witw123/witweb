import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { listPosts, createPost } from "@/lib/blog";
import { successResponse, errorResponses, createdResponse } from "@/lib/api-response";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateBody, validateQuery, z } from "@/lib/validate";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(5),
  q: z.string().default(""),
  author: z.string().default(""),
  tag: z.string().default(""),
  category: z.string().default(""),
});

const createPostSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空"),
  content: z.string().trim().min(1, "内容不能为空"),
  slug: z.string().trim().optional().or(z.literal("")),
  tags: z.string().default(""),
  category_id: z.coerce.number().int().positive().optional().or(z.literal("")).or(z.null()),
});

export const GET = withErrorHandler(async (req: Request) => {
  initDb();

  const { page, size, q, author, tag, category } = await validateQuery(req, listQuerySchema);
  const user = await getAuthUser();
  const data = listPosts(page, size, q, author, tag, user || "", category);

  return successResponse({
    items: data.items,
    total: data.total,
    page: data.page,
    size: data.size,
  });
});

export const POST = withErrorHandler(async (req: Request) => {
  initDb();

  const user = await getAuthUser();
  if (!user) return errorResponses.unauthorized("Missing token");

  const body = await validateBody(req, createPostSchema);
  const categoryId =
    body.category_id !== undefined &&
    body.category_id !== null &&
    body.category_id !== ""
      ? Number(body.category_id)
      : null;

  createPost(
    body.title,
    body.slug || null,
    body.content,
    user,
    body.tags || "",
    Number.isFinite(categoryId as number) ? categoryId : null
  );

  return createdResponse({ ok: true, user });
});
