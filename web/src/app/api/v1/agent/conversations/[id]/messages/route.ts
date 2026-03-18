import { AGENT_INPUT_TEXT } from "@/features/agent/constants";
import { agentAttachmentsSchema } from "@/lib/agent-attachments";
import { appendAgentConversationMessage } from "@/lib/agent-conversations";
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { validateBody, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const bodySchema = z
  .object({
    content: z.string().trim().default(""),
    template_id: z.string().trim().optional(),
    task_type: z
      .enum(["general_assistant", "hot_topic_article", "continue_article", "article_to_video", "publish_draft"])
      .optional(),
    attachments: agentAttachmentsSchema.optional().default([]),
  })
  .superRefine((value, ctx) => {
    if (!value.content && value.attachments.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: AGENT_INPUT_TEXT.streamEmptyContentError,
      });
    }
  });

export const POST = withErrorHandler(async (req, context: { params: Promise<{ id: string }> }) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  const body = await validateBody(req, bodySchema);
  const conversation = await appendAgentConversationMessage(id, user, {
    content: body.content || "",
    templateId: body.template_id,
    taskType: body.task_type,
    attachments: body.attachments,
  });
  return successResponse(conversation);
});
