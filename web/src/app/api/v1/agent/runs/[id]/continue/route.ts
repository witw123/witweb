/**
 * Agent 继续运行 API
 *
 * 为已存在的 Agent 运行任务发送继续指令，可指定不同的模型或系统提示词
 *
 * @route /api/v1/agent/runs/:id/continue
 * @method POST - 继续执行运行任务
 * @requiresAuth 需要用户认证
 */
import { continueRun } from "@/lib/agent";
import { AGENT_MODELS } from "@/lib/agent-llm";
import { errorResponses, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { validateBody, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const bodySchema = z.object({
  instruction: z.string().trim().min(2, "Instruction must be at least 2 characters"),
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
    return errorResponses.notFound("task_not_found");
  }
});
