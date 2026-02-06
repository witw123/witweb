/**
 */

import { NextRequest } from "next/server";
import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { listFavorites } from "@/lib/blog";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { paginatedResponse } from "@/lib/api-response";
import { validateQuery, z } from "@/lib/validate";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(10),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  initDb();

  // 鑾峰彇褰撳墠鐢ㄦ埛
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const { page, size } = await validateQuery(req, querySchema);

  const data = listFavorites(user, page, size);

  return paginatedResponse(data.items, data.total, page ?? 1, size ?? 10);
});

