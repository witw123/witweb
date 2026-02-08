import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { initDb } from "@/lib/db-init";
import { createRun } from "@/lib/agent";
import { AGENT_MODELS } from "@/lib/agent-llm";

const bodySchema = z.object({
  agent_type: z.enum(["topic", "writing", "publish"]),
  model: z.enum(AGENT_MODELS).default("gemini-3-pro"),
  goal: z.string().trim().min(3, "目标至少 3 个字符"),
});

export const POST = withErrorHandler(async (req) => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, bodySchema);
  const model = body.model ?? "gemini-3-pro";
  const result = await createRun(user, body.goal, body.agent_type, model);

  return successResponse({
    run_id: result.runId,
    status: result.status,
  });
});
