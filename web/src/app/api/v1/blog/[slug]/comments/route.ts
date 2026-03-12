/**
 * 文章评论 API
 *
 * 提供指定文章的评论列表查询与评论创建能力。
 * 评论展示和发布都依赖该路由，因此这里统一处理文章存在性校验、登录限制
 * 与评论作者资料补齐。
 *
 * @route /api/v1/blog/:slug/comments
 * @method GET - 获取文章评论列表
 * @method POST - 创建新评论
 */

import { createdResponse, errorResponses, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleCommentRepository, drizzlePostRepository, drizzleUserRepository } from "@/lib/repositories";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";

/**
 * 创建评论请求体 Schema。
 *
 * `parent_id` 同时兼容数字和字符串，是为了兼容来自不同表单实现的回复提交值。
 */
const createCommentSchema = z.object({
  content: z.string().min(1, "评论内容不能为空").max(2000, "评论最多 2000 字"),
  author: z.string().max(50, "作者名最多 50 字").optional(),
  parent_id: z.union([z.number(), z.string()]).optional().nullable(),
});

/**
 * 获取文章评论列表
 *
 * 先查询评论主数据，再按用户名批量补齐昵称和头像，避免评论查询直接依赖更重的联表。
 *
 * @param {Request} req - 当前请求对象
 * @param {{ params: Promise<{ slug: string }> }} context - 动态路由参数
 * @returns {Promise<Response>} 评论列表响应
 */
export const GET = withErrorHandler(async (req, { params }) => {
  const paramsData = await params;
  void req;

  const { slug } = paramsData;
  const comments = await drizzleCommentRepository.findByPostSlug(slug);

  const rows = await drizzleUserRepository.listBasicByUsernames(comments.map((item) => item.author));
  const userMap = new Map(rows.map((row) => [row.username, row]));

  const enriched = comments.map((item) => {
    const user = userMap.get(item.author);
    return {
      ...item,
      author_name: user?.nickname || item.author,
      author_avatar: user?.avatar_url || "",
    };
  });

  return successResponse(enriched);
});

/**
 * 创建文章评论
 *
 * 只允许登录用户评论，并在入库前确认目标文章存在。
 * 回复评论时会把 `parent_id` 归一化为数字，避免仓储层再处理表单差异。
 *
 * @param {Request} req - 当前请求对象
 * @param {{ params: Promise<{ slug: string }> }} context - 动态路由参数
 * @returns {Promise<Response>} 创建结果
 */
export const POST = withErrorHandler(async (req, { params }) => {
  const paramsData = await params;
  const { slug } = paramsData;

  const body = await validateBody(req, createCommentSchema);
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录后再评论");
  }

  const ip = req.headers.get("x-forwarded-for") || "";
  const parentId = body.parent_id
    ? typeof body.parent_id === "string"
      ? parseInt(body.parent_id, 10)
      : body.parent_id
    : null;

  const post = await drizzlePostRepository.findBySlug(slug);
  if (!post) {
    return errorResponses.notFound("文章不存在");
  }

  await drizzleCommentRepository.create({
    post_id: post.id,
    author: user,
    content: body.content.trim(),
    parent_id: parentId,
    ip_address: ip,
  });

  return createdResponse({ ok: true });
});
