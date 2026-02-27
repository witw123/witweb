/**
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/http";
import { postRepository, userRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { paginatedResponse } from "@/lib/api-response";
import { validateQuery, z } from "@/lib/validate";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(10),
});

export const GET = withErrorHandler(async (req: NextRequest) => {

  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const { page, size } = await validateQuery(req, querySchema);

  const data = await postRepository.listFavorites(user, page, size);
  const rows = await userRepository.listBasicByUsernames(data.items.map((item) => item.author));
  const userMap = new Map(rows.map((row) => [row.username, row]));

  const items = data.items.map((item) => {
    const author = userMap.get(item.author);
    return {
      ...item,
      author_name: author?.nickname || item.author,
      author_avatar: author?.avatar_url || "",
      tags: item.tags || "",
    };
  });

  return paginatedResponse(items, data.total, page ?? 1, size ?? 10);
});
