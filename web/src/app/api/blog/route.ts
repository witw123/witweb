import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { postRepository, userRepository } from "@/lib/repositories";
import { successResponse, errorResponses, createdResponse } from "@/lib/api-response";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateBody, validateQuery, z } from "@/lib/validate";
import type { PostListItem } from "@/types";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(5),
  q: z.string().default(""),
  author: z.string().default(""),
  tag: z.string().default(""),
  category: z.string().default(""),
});

const createPostSchema = z.object({
  title: z.string().trim().min(1, "鏍囬涓嶈兘涓虹┖"),
  content: z.string().trim().min(1, "鍐呭涓嶈兘涓虹┖"),
  slug: z.string().trim().optional().or(z.literal("")),
  tags: z.string().default(""),
  category_id: z.coerce.number().int().positive().optional().or(z.literal("")).or(z.null()),
});

function slugify(text: string): string {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureUniqueSlug(base: string): string {
  let slug = base || "post";
  let i = 1;
  while (postRepository.findBySlug(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

function attachAuthorProfile(items: PostListItem[]): PostListItem[] {
  const rows = userRepository.listBasicByUsernames(items.map((item) => item.author));
  const userMap = new Map(rows.map((row) => [row.username, row]));
  return items.map((item) => {
    const user = userMap.get(item.author);
    return {
      ...item,
      author_name: user?.nickname || item.author,
      author_avatar: user?.avatar_url || "",
      tags: item.tags || "",
    };
  });
}

export const GET = withErrorHandler(async (req: Request) => {
  initDb();

  const { page, size, q, author, tag, category } = await validateQuery(req, listQuerySchema);
  const user = await getAuthUser();

  const authorAliases: string[] = [];
  if (author) {
    authorAliases.push(author);
    const authorRow = userRepository.findByUsername(author);
    if (authorRow?.id !== undefined && authorRow?.id !== null) {
      authorAliases.push(String(authorRow.id));
    }
  }

  const data = postRepository.list({
    page,
    size,
    query: q,
    author,
    authorAliases,
    tag,
    category,
    username: user || "",
  });

  return successResponse({
    items: attachAuthorProfile(data.items as PostListItem[]),
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

  const base = body.slug?.trim() ? slugify(body.slug) : slugify(body.title);
  const uniqueSlug = ensureUniqueSlug(base);

  postRepository.create({
    title: body.title,
    slug: uniqueSlug,
    content: body.content,
    author: user,
    tags: body.tags || "",
    category_id: Number.isFinite(categoryId as number) ? categoryId : null,
  });

  return createdResponse({ ok: true, user });
});
