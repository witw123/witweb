/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { listComments, addComment } from "@/lib/blog";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses, createdResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const createCommentSchema = z.object({
  content: z.string().min(1, "评论内容不能为空").max(2000, "评论最多2000字"),
  author: z.string().max(50, "作者名最多50字").optional(),
  parent_id: z.union([z.number(), z.string()]).optional().nullable(),
});

/**
 * GET /api/blog/[slug]/comments
 */
export const GET = withErrorHandler(async (req, { params }) => {
  const paramsData = await params;
  initDb();
  void req;

  const { slug } = paramsData;

  const comments = listComments(slug);

  return successResponse(comments);
});

/**
 * POST /api/blog/[slug]/comments
 */
export const POST = withErrorHandler(async (req, { params }) => {
  const paramsData = await params;
  initDb();

  const { slug } = paramsData;

  // 验证请求体
  const body = await validateBody(req, createCommentSchema);

  // 获取当前用户（可选）
  const user = await getAuthUser();
  const author = user || body.author || "访客";

  // 获取客户端 IP
  const ip = req.headers.get("x-forwarded-for") || "";

  // 处理 parent_id
  const parentId = body.parent_id
    ? (typeof body.parent_id === "string" ? parseInt(body.parent_id, 10) : body.parent_id)
    : null;

  // 添加评论
  const result = addComment(slug, author, body.content.trim(), parentId, ip);

  if (!result.ok) {
    return errorResponses.notFound("文章不存在");
  }

  return createdResponse({ ok: true });
});
