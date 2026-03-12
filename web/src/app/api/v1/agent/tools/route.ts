import { listAgentTools } from "@/lib/agent-tools";
import { successResponse } from "@/lib/api-response";
import { withErrorHandler } from "@/middleware/error-handler";

export const GET = withErrorHandler(async () => {
  return successResponse({
    items: listAgentTools(),
  });
});
