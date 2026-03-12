import { getAgentGoalTimeline } from "@/lib/agent-goals";
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

export const GET = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  const result = await getAgentGoalTimeline(id, user);
  return successResponse(result);
});
