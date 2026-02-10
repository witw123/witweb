import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { initDb } from "@/lib/db-init";
import { fetchAllEnabledSources, fetchRadarSourceNow } from "@/lib/topic-radar";

const bodySchema = z.object({
  source_id: z.coerce.number().int().positive().optional(),
});

export const POST = withErrorHandler(async (req) => {
  initDb();
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
