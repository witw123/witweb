import { AGENT_INPUT_TEXT, AGENT_THINKING_PHASES } from "@/features/agent/constants";
import { appendAgentConversationMessageIncremental } from "@/lib/agent-conversations";
import { getAuthUser } from "@/lib/http";
import { validateBody, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const bodySchema = z.object({
  content: z.string().trim().min(1, AGENT_INPUT_TEXT.streamEmptyContentError),
  template_id: z.string().trim().optional(),
  task_type: z
    .enum(["general_assistant", "hot_topic_article", "continue_article", "article_to_video", "publish_draft"])
    .optional(),
});

function streamLine(payload: unknown) {
  return `${JSON.stringify(payload)}\n`;
}

export const POST = withErrorHandler(async (req, context: { params: Promise<{ id: string }> }) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  const body = await validateBody(req, bodySchema);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (payload: unknown) => controller.enqueue(encoder.encode(streamLine(payload)));
      try {
        for (const phase of AGENT_THINKING_PHASES) {
          push({ type: "phase", key: phase.key, title: phase.title, status: "pending" });
        }

        const conversation = await appendAgentConversationMessageIncremental(
          id,
          user,
          {
            content: body.content,
            templateId: body.template_id,
            taskType: body.task_type,
          },
          {
            onPhase: (event) => {
              push({ type: "phase", ...event });
            },
            onDelta: (chunk, messageId) => {
              push({ type: "delta", message_id: messageId, chunk });
            },
          }
        );

        push({ type: "done", conversation });
      } catch (error) {
        push({
          type: "error",
          message: error instanceof Error ? error.message : "conversation_stream_failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
