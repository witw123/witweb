/**
 * Radar 数据抓取 API
 *
 * 手动触发 Radar 数据源抓取，可指定单个数据源或抓取所有已启用的数据源
 *
 * @route /api/v1/radar/fetch
 * @method POST - 触发数据源抓取
 * @requiresAuth 需要用户认证
 */
import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { fetchAllEnabledSources, fetchRadarSourceNow } from "@/lib/topic-radar";

const bodySchema = z.object({
  source_id: z.coerce.number().int().positive().optional(),
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  const body = await validateBody(req, bodySchema);

  if (body.source_id) {
    const result = await fetchRadarSourceNow(body.source_id, user);
    return successResponse({ results: [result] });
  }

  const results = await fetchAllEnabledSources(user);
  return successResponse({ results });
});
