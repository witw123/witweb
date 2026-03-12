import { createAgentGoal } from "@/lib/agent-goals";
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { validateBody, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const bodySchema = z.object({
  goal: z.string().trim().min(2, "目标至少需要 2 个字符"),
  conversation_id: z.string().trim().optional(),
  execution_mode: z.enum(["confirm", "auto_low_risk"]).default("auto_low_risk"),
  template_id: z.string().trim().optional(),
  task_type: z
    .enum(["general_assistant", "hot_topic_article", "continue_article", "article_to_video", "publish_draft"])
    .optional(),
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, bodySchema);
  const result = await createAgentGoal(user, {
    goal: body.goal,
    conversationId: body.conversation_id,
    executionMode: body.execution_mode,
    templateId: body.template_id,
    taskType: body.task_type,
  });

  return successResponse(result);
});
