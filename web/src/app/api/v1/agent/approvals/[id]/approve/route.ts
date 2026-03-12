import { approveAgentAction } from "@/lib/agent-goals";
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

export const POST = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  const result = await approveAgentAction(Number(id), user);
  return successResponse(result);
});
