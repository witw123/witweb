/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { commentRepository, postRepository, userRepository } from "@/lib/repositories";
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
  const comments = commentRepository.findByPostSlug(slug);

  const rows = userRepository.listBasicByUsernames(comments.map((item) => item.author));
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
 * POST /api/blog/[slug]/comments
 */
export const POST = withErrorHandler(async (req, { params }) => {
  const paramsData = await params;
  initDb();

  const { slug } = paramsData;

  const body = await validateBody(req, createCommentSchema);

  const user = await getAuthUser();
  const author = user || body.author || "访客";

  const ip = req.headers.get("x-forwarded-for") || "";

  const parentId = body.parent_id
    ? (typeof body.parent_id === "string" ? parseInt(body.parent_id, 10) : body.parent_id)
    : null;

  const post = postRepository.findBySlug(slug);
  if (!post) {
    return errorResponses.notFound("文章不存在");
  }

  commentRepository.create({
    post_id: post.id,
    author,
    content: body.content.trim(),
    parent_id: parentId,
    ip_address: ip,
  });

  return createdResponse({ ok: true });
});
