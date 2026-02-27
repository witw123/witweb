import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateQuery, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { listRuns } from "@/lib/agent";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { page, size } = await validateQuery(req, querySchema);
  const result = await listRuns(user, page ?? 1, size ?? 20);
  return successResponse(result);
});
