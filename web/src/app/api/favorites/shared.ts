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

export async function buildFavoritesGetResponse(req: Request): Promise<Response> {
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const { page, size } = await validateQuery(req, favoritesQuerySchema);
  const data = await drizzlePostRepository.listFavorites(user, page, size);
  const rows = await userRepository.listBasicByUsernames(data.items.map((item) => item.author));

  return paginatedResponse(attachAuthorProfile(data.items, rows), data.total, data.page, data.size);
}
