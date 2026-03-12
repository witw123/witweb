import { successResponse } from "@/lib/api-response";
import { dispatchContentEvent } from "@/lib/integrations/n8n";
import { getAuthUser } from "@/lib/http";
import { validateBody, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const bodySchema = z.object({
  event_type: z.enum(["content.draft.created", "content.post.published", "content.video.ready"]),
  payload: z.record(z.unknown()).default({}),
  goal_id: z.string().trim().optional(),
  target_url: z.string().trim().url().optional(),
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, bodySchema);
  const result = await dispatchContentEvent(user, {
    eventType: body.event_type,
    payload: body.payload || {},
    goalId: body.goal_id,
    targetUrl: body.target_url,
  });

  return successResponse(result);
});
