/**
 * 文章点踩 API
 *
 * 为文章添加或取消点踩，支持切换状态（再次点击取消点踩）
 *
 * @route /api/v1/blog/:slug/dislike
 * @method POST - 点踩/取消点踩文章
 */

import { getAuthUser } from "@/lib/http";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { drizzlePostRepository } from "@/lib/repositories";
import { successResponse, errorResponses } from "@/lib/api-response";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  slug: z.string().trim().min(1, "slug is required"),
});

/**
 * 点踩/取消点踩文章
 *
 * 切换用户对文章的点踩状态，返回最新的点赞/点踩/收藏/评论数
 * 再次点击已点踩的文章将取消点踩
 *
 * @route POST /api/v1/blog/:slug/dislike
 * @param {string} slug - 文章 slug 路径参数
 * @returns {object} 点踩状态及更新后的计数
 */
export const POST = withErrorHandler(async (_: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { slug } = validateParams(await params, paramsSchema);
  let disliked = false;
  try {
    const result = await drizzlePostRepository.toggleLike(slug, user, -1);
    disliked = !!result.disliked;
  } catch (error) {
    if (error instanceof ApiError && error.code === ErrorCode.POST_NOT_FOUND) {
      return errorResponses.notFound("Post not found");
    }
    throw error;
  }

  const post = await drizzlePostRepository.getPostDetail(slug, user);
  return successResponse({
    ok: true,
    disliked,
    like_count: post?.like_count ?? 0,
    dislike_count: post?.dislike_count ?? 0,
    favorite_count: post?.favorite_count ?? 0,
    comment_count: post?.comment_count ?? 0,
  });
});
