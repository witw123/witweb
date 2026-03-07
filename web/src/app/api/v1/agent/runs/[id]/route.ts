import { deleteRun, getRunDetail } from "@/lib/agent";
import { errorResponses, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

export const GET = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  try {
    const detail = await getRunDetail(id, user);
    return successResponse(detail);
  } catch {
    return errorResponses.notFound("task_not_found");
  }
});

export const DELETE = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  try {
    const result = await deleteRun(id, user);
    return successResponse(result);
  } catch {
    return errorResponses.notFound("task_not_found");
  }
});
