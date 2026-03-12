/**
 * 收藏列表 API 共享处理函数
 *
 * 提供获取用户收藏文章列表的通用处理逻辑
 *
 * @route /api/favorites
 * @method GET - 获取收藏列表
 */
import { paginatedResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzlePostRepository, userRepository } from "@/lib/repositories";
import { validateQuery, z } from "@/lib/validate";
import { assertAuthenticated } from "@/middleware/error-handler";
import type { PostListItem } from "@/types";

export const favoritesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(10),
});

function attachAuthorProfile(
  items: PostListItem[],
  rows: Awaited<ReturnType<typeof userRepository.listBasicByUsernames>>,
) {
  const userMap = new Map(rows.map((row) => [row.username, row]));
  return items.map((item) => {
    const author = userMap.get(item.author);
    return {
      ...item,
      author_name: author?.nickname || item.author,
      author_avatar: author?.avatar_url || "",
      tags: item.tags || "",
    };
  });
}

/**
 * 构建收藏列表响应
 *
 * 获取当前用户收藏的所有文章，带分页和作者信息
 *
 * @param {Request} req - HTTP 请求对象
 * @returns {Promise<Response>} 分页的收藏列表响应
 */
export async function buildFavoritesGetResponse(req: Request): Promise<Response> {
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const { page, size } = await validateQuery(req, favoritesQuerySchema);
  const data = await drizzlePostRepository.listFavorites(user, page, size);
  const rows = await userRepository.listBasicByUsernames(data.items.map((item) => item.author));

  return paginatedResponse(attachAuthorProfile(data.items, rows), data.total, data.page, data.size);
}
