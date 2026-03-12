/**
 * Radar 订阅源管理 API
 *
 * 获取和创建 Radar 订阅源
 *
 * @route /api/v1/radar/sources
 * @method GET - 获取订阅源列表
 * @method POST - 创建订阅源
 */

import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { createRadarSource, listRadarSources } from "@/lib/topic-radar";

/** 请求体验证 Schema */
const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().url(),
  type: z.enum(["rss", "html", "api"]).default("rss"),
  parser_config_json: z.string().trim().max(10000).optional(),
  enabled: z.boolean().optional(),
});

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  return successResponse({ items: await listRadarSources(user) });
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, bodySchema);
  const created = await createRadarSource({
    username: user,
    name: body.name,
    url: body.url,
    type: body.type ?? "rss",
    parserConfigJson: body.parser_config_json,
    enabled: body.enabled,
  });

  return successResponse({ id: created.id });
});
