/**
 * Radar 话题列表 API
 *
 * 获取和清除 Radar 话题列表
 *
 * @route /api/v1/radar/items
 * @method GET - 获取话题列表
 * @method DELETE - 清除话题列表
 */

import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateQuery, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { clearRadarItems, listRadarItems } from "@/lib/topic-radar";

/** 查询参数验证 Schema */
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(80),
  q: z.string().trim().optional(),
  source_id: z.coerce.number().int().positive().optional(),
});

export const GET = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  const query = await validateQuery(req, querySchema);

  const items = await listRadarItems(user, {
    limit: query.limit,
    q: query.q,
    sourceId: query.source_id,
  });

  return successResponse({ items });
});

export const DELETE = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  const query = await validateQuery(req, z.object({ source_id: z.coerce.number().int().positive().optional() }));

  const result = await clearRadarItems(user, {
    sourceId: query.source_id,
  });
  return successResponse(result);
});
