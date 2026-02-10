import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { initDb } from "@/lib/db-init";
import { createRadarNotification, listRadarNotifications } from "@/lib/topic-radar";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  webhook_url: z.string().trim().url(),
  secret: z.string().trim().max(200).optional(),
  enabled: z.boolean().optional(),
});

export const GET = withErrorHandler(async () => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);
  return successResponse({ items: listRadarNotifications(user) });
});

export const POST = withErrorHandler(async (req) => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);
  const body = await validateBody(req, bodySchema);

  const created = createRadarNotification({
    username: user,
    name: body.name,
    webhookUrl: body.webhook_url,
    secret: body.secret,
    enabled: body.enabled,
  });
  return successResponse(created);
});

