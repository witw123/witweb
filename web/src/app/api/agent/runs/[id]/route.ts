import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { getRunDetail, deleteRun } from "@/lib/agent";

export const GET = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  try {
    const detail = await getRunDetail(id, user);
    return successResponse(detail);
  } catch {
    return errorResponses.notFound("任务不存在");
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
    return errorResponses.notFound("任务不存在");
  }
});
