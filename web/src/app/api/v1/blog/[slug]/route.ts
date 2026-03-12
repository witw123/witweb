/**
 * 博客文章详情 API
 *
 * 负责单篇文章的读取、更新和删除。
 * 该路由处在内容详情页与编辑入口之间，因此除了基础 CRUD 外，还承担
 * 鉴权、参数校验和作者信息补齐等边界逻辑。
 *
 * @route /api/v1/blog/{slug}
 * @method GET - 获取文章详情
 * @method PUT - 更新文章
 * @method DELETE - 删除文章
 */

import { getAuthUser, isAdminUser } from "@/lib/http";
import { syncPostKnowledge } from "@/lib/content-sync";
import { drizzlePostRepository, postRepository, userRepository } from "@/lib/repositories";
import { successResponse, errorResponses } from "@/lib/api-response";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, validateParams, z } from "@/lib/validate";

/** 详情路由参数 Schema。 */
const paramsSchema = z.object({
  slug: z.string().trim().min(1, "slug is required"),
});

/**
 * 更新文章请求体 Schema。
 *
 * 这里允许空字符串和 null 同时存在，以兼容不同表单控件对“未选择分类”的表达方式。
 */
const updatePostSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  content: z.string().trim().min(1, "Content is required"),
  tags: z.string().optional().default(""),
  category_id: z.coerce.number().int().positive().optional().or(z.literal("")).or(z.null()),
  excerpt: z.string().trim().max(200).optional().nullable(),
  cover_image_url: z.string().trim().optional().nullable(),
});

/**
 * 获取文章详情
 *
 * 如果请求已登录，会带上当前用户名用于返回点赞、收藏等用户态字段。
 *
 * @param {Request} _ - 未使用的请求对象
 * @param {{ params: Promise<{ slug: string }> }} context - 动态路由参数
 * @returns {Promise<Response>} 文章详情响应
 */
export const GET = withErrorHandler(async (_: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const user = await getAuthUser();
  const { slug } = validateParams(await params, paramsSchema);
  const post = await drizzlePostRepository.getPostDetail(slug, user || undefined);
  if (!post) return errorResponses.notFound("Post not found");

  // 作者昵称和头像属于扩展资料，按需补齐，避免详情查询与用户表硬绑定。
  const authorRow = await userRepository.findByUsername(post.author);
  return successResponse({
    ...post,
    author_name: authorRow?.nickname || post.author,
    author_avatar: authorRow?.avatar_url || "",
    tags: post.tags || "",
  });
});

/**
 * 更新文章
 *
 * 仅文章作者本人可修改内容；此处不放宽到管理员，保持编辑权限和发布归属一致。
 *
 * @param {Request} req - 当前请求对象
 * @param {{ params: Promise<{ slug: string }> }} context - 动态路由参数
 * @returns {Promise<Response>} 更新结果
 */
export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { slug } = validateParams(await params, paramsSchema);
  const body = await validateBody(req, updatePostSchema);
  // 表单里的空分类统一折叠为 null，避免仓储层感知 UI 细节。
  const categoryId =
    body.category_id !== undefined &&
    body.category_id !== null &&
    body.category_id !== ""
      ? Number(body.category_id)
      : null;

  const existing = await drizzlePostRepository.findBySlug(slug);
  if (!existing) return errorResponses.notFound("Post not found");
  if (existing.author !== user) return errorResponses.forbidden("Forbidden");

  await drizzlePostRepository.updateBySlug(slug, {
    title: body.title,
    content: body.content,
    tags: body.tags || "",
    category_id: Number.isFinite(categoryId as number) ? categoryId : null,
    ...(body.excerpt ? { excerpt: body.excerpt } : {}),
    ...(body.cover_image_url ? { cover_image_url: body.cover_image_url } : {}),
  });

  await syncPostKnowledge(user, {
    slug,
    title: body.title,
    content: body.content,
    excerpt: body.excerpt || null,
    tags: body.tags || "",
    status: existing.status || "published",
    category_id: Number.isFinite(categoryId as number) ? categoryId : null,
    cover_image_url: body.cover_image_url || null,
  }).catch(() => null);

  return successResponse({ ok: true, slug });
});

/**
 * 删除文章
 *
 * 作者本人和管理员都可以执行删除；这里走仓储层硬删除实现，保持后台和前台入口一致。
 *
 * @param {Request} _ - 未使用的请求对象
 * @param {{ params: Promise<{ slug: string }> }} context - 动态路由参数
 * @returns {Promise<Response>} 删除结果
 */
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
