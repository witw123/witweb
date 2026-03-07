import { createdResponse, errorResponses, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleCommentRepository, drizzlePostRepository, drizzleUserRepository } from "@/lib/repositories";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";

const createCommentSchema = z.object({
  content: z.string().min(1, "评论内容不能为空").max(2000, "评论最多 2000 字"),
  author: z.string().max(50, "作者名最多 50 字").optional(),
  parent_id: z.union([z.number(), z.string()]).optional().nullable(),
});

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
