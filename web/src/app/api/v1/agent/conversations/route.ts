import { AGENT_INPUT_TEXT } from "@/features/agent/constants";
import { createdResponse, successResponse } from "@/lib/api-response";
import { createAgentConversation, listAgentConversations } from "@/lib/agent-conversations";
import { getAuthUser } from "@/lib/http";
import { validateBody, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const bodySchema = z.object({
  title: z.string().trim().optional(),
});

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const items = await listAgentConversations(user);
  return successResponse({ items });
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, bodySchema);
  const conversation = await createAgentConversation(user, body.title || AGENT_INPUT_TEXT.newConversation);
  return createdResponse(conversation);
});
