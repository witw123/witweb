import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateQuery, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { initDb } from "@/lib/db-init";
import { clearRadarItems, listRadarItems } from "@/lib/topic-radar";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(80),
  q: z.string().trim().optional(),
  source_id: z.coerce.number().int().positive().optional(),
});

export const GET = withErrorHandler(async (req) => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);
  const query = await validateQuery(req, querySchema);

  const items = listRadarItems(user, {
    limit: query.limit,
    q: query.q,
    sourceId: query.source_id,
  });

  return successResponse({ items });
});

export const DELETE = withErrorHandler(async (req) => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);
  const query = await validateQuery(req, z.object({ source_id: z.coerce.number().int().positive().optional() }));

  const result = clearRadarItems(user, {
    sourceId: query.source_id,
  });
  return successResponse(result);
});
