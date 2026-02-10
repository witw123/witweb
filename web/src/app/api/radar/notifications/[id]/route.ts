import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse, errorResponses } from "@/lib/api-response";
import { initDb } from "@/lib/db-init";
import { deleteRadarNotification, updateRadarNotification } from "@/lib/topic-radar";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  webhook_url: z.string().trim().url().optional(),
  secret: z.string().trim().max(200).optional(),
  enabled: z.boolean().optional(),
});

export const PATCH = withErrorHandler(async (req, context) => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);
  const { id } = await context.params;
  const notificationId = Number(id);
  const body = await validateBody(req, bodySchema);

  try {
    updateRadarNotification(notificationId, user, {
      name: body.name,
      webhookUrl: body.webhook_url,
      secret: body.secret,
      enabled: body.enabled,
    });
    return successResponse({ id: notificationId, updated: true });
  } catch {
    return errorResponses.notFound("notification_not_found");
  }
});

export const DELETE = withErrorHandler(async (_req, context) => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);
  const { id } = await context.params;
  const notificationId = Number(id);

  try {
    deleteRadarNotification(notificationId, user);
    return successResponse({ id: notificationId, deleted: true });
  } catch {
    return errorResponses.notFound("notification_not_found");
  }
});

