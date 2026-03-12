import { ensureConversationForGoal, getAgentConversation } from "@/lib/agent-conversations";
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

export const GET = withErrorHandler(async (_req, context: { params: Promise<{ goalId: string }> }) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { goalId } = await context.params;
  const conversationId = await ensureConversationForGoal(goalId, user);
  const conversation = await getAgentConversation(conversationId, user);
  return successResponse(conversation);
});
