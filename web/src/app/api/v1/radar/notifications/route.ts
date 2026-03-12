/**
 * Radar 通知渠道管理 API
 *
 * 获取用户配置的通知渠道列表，或创建新的 Webhook 通知渠道
 *
 * @route /api/v1/radar/notifications
 * @method GET - 获取通知渠道列表
 * @method POST - 创建新通知渠道
 * @requiresAuth 需要用户认证
 */
import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { createRadarNotification, listRadarNotifications } from "@/lib/topic-radar";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  webhook_url: z.string().trim().url(),
  secret: z.string().trim().max(200).optional(),
  enabled: z.boolean().optional(),
});

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  return successResponse({ items: await listRadarNotifications(user) });
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  const body = await validateBody(req, bodySchema);

  const created = await createRadarNotification({
    username: user,
    name: body.name,
    webhookUrl: body.webhook_url,
    secret: body.secret,
    enabled: body.enabled,
  });
  return successResponse(created);
});
