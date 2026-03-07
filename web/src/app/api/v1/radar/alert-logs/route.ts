import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateQuery, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { listRadarAlertLogs } from "@/lib/topic-radar";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(80),
  status: z.enum(["success", "failed"]).optional(),
});

export const GET = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  const query = await validateQuery(req, querySchema);

  const items = await listRadarAlertLogs(user, {
    limit: query.limit,
    status: query.status,
  });

  return successResponse({ items });
});
