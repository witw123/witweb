import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse, errorResponses } from "@/lib/api-response";
import { continueRun } from "@/lib/agent";
import { AGENT_MODELS } from "@/lib/agent-llm";

const bodySchema = z.object({
  instruction: z.string().trim().min(2, "请提供补充指令"),
  model: z.enum(AGENT_MODELS).optional(),
  assistant_name: z.string().trim().max(40).optional(),
  custom_system_prompt: z.string().trim().max(4000).optional(),
});

export const POST = withErrorHandler(async (req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  const body = await validateBody(req, bodySchema);

  try {
    const result = await continueRun(id, user, body.instruction, body.model, {
      assistantName: body.assistant_name,
      customSystemPrompt: body.custom_system_prompt,
    });
    return successResponse({
      run_id: result.runId,
      status: result.status,
    });
  } catch {
    return errorResponses.notFound("任务不存在");
  }
});
