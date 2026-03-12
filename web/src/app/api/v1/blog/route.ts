/**
 * 博客文章 API
 *
 * 负责博客文章的列表查询与创建。
 * 该路由同时服务首页列表、作者筛选和发布入口，因此需要在入口层
 * 统一完成查询参数归一化、鉴权校验和 slug 补全，避免下游仓储层承担
 * 过多 HTTP 语义判断。
 *
 * @route /api/v1/blog
 * @method GET - 获取文章列表
 * @method POST - 创建新文章
 */

import { getAuthUser } from "@/lib/http";
import { syncPostContentLifecycle } from "@/lib/content-sync";
import { drizzlePostRepository, userRepository } from "@/lib/repositories";
import { successResponse, errorResponses, createdResponse } from "@/lib/api-response";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateBody, validateQuery, z } from "@/lib/validate";
import type { PostListItem } from "@/types";

/**
 * 文章列表查询参数 Schema
 *
 * 统一在路由层约束分页、搜索和筛选参数，保证仓储层收到的都是
 * 已归一化的值，避免出现空字符串与 undefined 混用。
 */
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(5),
  q: z.string().default(""),
  author: z.string().default(""),
  tag: z.string().default(""),
  category: z.string().default(""),
});

/**
 * 创建文章请求体 Schema
 *
 * 发布页允许部分类别字段以空字符串传入，这里先兼容前端表单值，
 * 后续再在路由层转换为数据库所需的 `null | number`。
 */
const createPostSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空"),
  content: z.string().trim().min(1, "内容不能为空"),
  slug: z.string().trim().optional().or(z.literal("")),
  tags: z.string().default(""),
  category_id: z.coerce.number().int().positive().optional().or(z.literal("")).or(z.null()),
  excerpt: z.string().trim().max(200).optional().nullable(),
  cover_image_url: z.string().trim().optional().nullable(),
});

/**
 * 将文本转换为 URL 友好的 slug
 *
 * 同时保留中文字符，兼顾中文标题直出和英文标题可读性。
 * 这里不做唯一性处理，只负责稳定的基础规范化。
 *
 * @param {string} text - 原始文本
 * @returns {string} slug 字符串
 */
function slugify(text: string): string {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * 确保 slug 唯一
 *
 * 如果 slug 已存在，则在末尾追加数字后缀。
 * 唯一性放在创建前兜底，避免调用方都重复实现同样的重试逻辑。
 *
 * @param {string} base - 基础 slug
 * @returns {Promise<string>} 唯一的 slug
 */
async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base || "post";
  let i = 1;
  while (await drizzlePostRepository.findBySlug(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

/**
 * 为文章列表附加作者信息
 *
 * 列表查询的主结果不强依赖用户扩展资料，因此先由文章仓储返回主数据，
 * 再在这里批量补齐作者昵称和头像，避免列表查询与用户表强耦合。
 *
 * @param {PostListItem[]} items - 文章列表
 * @returns {Promise<PostListItem[]>} 附加作者信息后的列表
 */
async function attachAuthorProfile(items: PostListItem[]): Promise<PostListItem[]> {
  const rows = await userRepository.listBasicByUsernames(items.map((item) => item.author));
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

/**
 * 获取文章列表
 *
 * 支持分页、关键词、作者、标签和分类筛选。
 * 当传入作者名时，会同时兼容历史上以用户 ID 存储作者字段的旧数据。
 *
 * @param {Request} req - 当前请求对象
 * @returns {Promise<Response>} 标准成功响应，包含分页后的文章列表
 */
export const GET = withErrorHandler(async (req: Request) => {
  const { page, size, q, author, tag, category } = await validateQuery(req, listQuerySchema);
  const user = await getAuthUser();

  const authorAliases: string[] = [];
  if (author) {
    authorAliases.push(author);
    const authorRow = await userRepository.findByUsername(author);
    if (authorRow?.id !== undefined && authorRow?.id !== null) {
      // 历史数据里 author 字段可能记录了用户 ID，这里一起带入兼容查询。
      authorAliases.push(String(authorRow.id));
    }
  }

  const data = await drizzlePostRepository.list({
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
    items: await attachAuthorProfile(data.items as PostListItem[]),
    total: data.total,
    page: data.page,
    size: data.size,
  });
});

/**
 * 创建文章
 *
 * 仅允许已登录用户发布文章。路由层负责将前端表单值转换为仓储层需要的
 * 数据结构，并在入库前确保 slug 可用，避免冲突错误直接暴露到客户端。
 *
 * @param {Request} req - 当前请求对象
 * @returns {Promise<Response>} 创建成功响应，包含最终使用的 slug
 */
export const POST = withErrorHandler(async (req: Request) => {
  const user = await getAuthUser();
  if (!user) return errorResponses.unauthorized("Missing token");

  const body = await validateBody(req, createPostSchema);
  // 表单提交可能把“未选择分类”表示为空字符串，这里统一折叠为 null。
  const categoryId =
    body.category_id !== undefined &&
    body.category_id !== null &&
    body.category_id !== ""
      ? Number(body.category_id)
      : null;

  // 优先尊重用户自定义 slug；未提供时再回退到标题生成。
  const base = body.slug?.trim() ? slugify(body.slug) : slugify(body.title);
  const uniqueSlug = await ensureUniqueSlug(base);

  await drizzlePostRepository.create({
    title: body.title,
    slug: uniqueSlug,
    content: body.content,
    author: user,
    tags: body.tags || "",
    category_id: Number.isFinite(categoryId as number) ? categoryId : null,
    ...(body.excerpt ? { excerpt: body.excerpt } : {}),
    ...(body.cover_image_url ? { cover_image_url: body.cover_image_url } : {}),
  });

  await syncPostContentLifecycle(user, {
    slug: uniqueSlug,
    title: body.title,
    content: body.content,
    excerpt: body.excerpt || null,
    tags: body.tags || "",
    status: "published",
    category_id: Number.isFinite(categoryId as number) ? categoryId : null,
    cover_image_url: body.cover_image_url || null,
  }).catch(() => null);

  return createdResponse({ ok: true, slug: uniqueSlug });
});
