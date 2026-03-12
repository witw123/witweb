import { listAvailableModels } from "@/lib/ai-models";
import { resolveApiConfig } from "@/lib/api-registry";
import { successResponse } from "@/lib/api-response";
import { withErrorHandler } from "@/middleware/error-handler";

export const GET = withErrorHandler(async () => {
  const managed = await resolveApiConfig("agent_llm");
  return successResponse({
    items: listAvailableModels(),
    active_binding: managed
      ? {
          source: managed.source,
          provider_code: managed.provider_code,
          connection_id: managed.connection_id || null,
          connection_name: managed.connection_name || null,
          model: managed.model,
          base_url: managed.base_url,
        }
      : null,
  });
});
