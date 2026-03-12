import { deleteAgentConversation, getAgentConversation } from "@/lib/agent-conversations";
import { noContentResponse, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

export const GET = withErrorHandler(async (_req, context: { params: Promise<{ id: string }> }) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  const conversation = await getAgentConversation(id, user);
  return successResponse(conversation);
});

export const DELETE = withErrorHandler(async (_req, context: { params: Promise<{ id: string }> }) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  const deleted = await deleteAgentConversation(id, user);
  if (!deleted) throw new Error("conversation_not_found");
  return noContentResponse();
});
