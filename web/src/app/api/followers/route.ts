/**
 */

import { NextRequest } from "next/server";
import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { listFollowers } from "@/lib/follow";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateQuery, z } from "@/lib/validate";

const querySchema = z.object({
  username: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional().default(""),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  initDb();

  // 楠岃瘉鐢ㄦ埛璁よ瘉
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  const { username, page, size, q } = await validateQuery(req, querySchema);

  const targetUsername = username || user;

  const result = listFollowers(targetUsername, page, size, q);

  return successResponse(result);
});

