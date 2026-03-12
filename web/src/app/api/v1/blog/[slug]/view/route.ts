/**
 * 文章浏览量 API
 *
 * 记录文章浏览次数，每调用一次增加浏览量route /api/v1/blog/:slug
 *
 * @/view
 * @method POST - 增加文章浏览量
 */

import { drizzlePostRepository } from "@/lib/repositories";
import { successResponse } from "@/lib/api-response";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  slug: z.string().trim().min(1, "slug is required"),
});

/**
 * 增加文章浏览量
 *
 * 每当用户访问文章详情页时调用，增加文章的浏览计数
 *
 * @route POST /api/v1/blog/:slug/view
 * @param {string} slug - 文章 slug 路径参数
 * @returns {object} 更新后的浏览量
 */
export const POST = withErrorHandler(async (_: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = validateParams(await params, paramsSchema);
  const viewCount = await drizzlePostRepository.incrementViewCount(slug);
  return successResponse({ ok: true, view_count: viewCount });
});
