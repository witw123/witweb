/**
 * Radar 数据源管理 API（单个）
 *
 * 更新或删除指定的 Radar 数据源
 *
 * @route /api/v1/radar/sources/:id
 * @method PATCH - 更新数据源
 * @method DELETE - 删除数据源
 * @requiresAuth 需要用户认证
 */
import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse, errorResponses } from "@/lib/api-response";
import { updateRadarSource, deleteRadarSource } from "@/lib/topic-radar";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  url: z.string().trim().url().optional(),
  type: z.enum(["rss", "html", "api"]).optional(),
  parser_config_json: z.string().trim().max(10000).optional(),
  enabled: z.boolean().optional(),
});

export const PATCH = withErrorHandler(async (req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  const { id } = await context.params;
  const sourceId = Number(id);
  const body = await validateBody(req, bodySchema);

  try {
    await updateRadarSource(sourceId, user, {
      name: body.name,
      url: body.url,
      type: body.type,
      parserConfigJson: body.parser_config_json,
      enabled: body.enabled,
    });
    return successResponse({ id: sourceId, updated: true });
  } catch {
    return errorResponses.notFound("来源不存在");
  }
});

export const DELETE = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  const { id } = await context.params;
  const sourceId = Number(id);

  try {
    await deleteRadarSource(sourceId, user);
    return successResponse({ id: sourceId, deleted: true });
  } catch {
    return errorResponses.notFound("来源不存在");
  }
});
