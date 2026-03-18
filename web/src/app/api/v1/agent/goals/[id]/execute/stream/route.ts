import { executeAgentGoal } from "@/lib/agent-goals";
import { getAuthUser } from "@/lib/http";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

function streamLine(payload: unknown) {
  return `${JSON.stringify(payload)}\n`;
}

export const POST = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (payload: unknown) => controller.enqueue(encoder.encode(streamLine(payload)));
      try {
        const timeline = await executeAgentGoal(id, user, {
          onEvent: (event) => {
            if (event.kind === "goal_status") {
              push({ type: "goal_status", event });
              return;
            }
            if (event.kind === "tool_start") {
              push({ type: "tool_start", event });
              return;
            }
            if (event.kind === "tool_result") {
              push({ type: "tool_result", event });
              return;
            }
            if (event.kind === "artifact") {
              push({ type: "artifact", event });
              return;
            }
            push({ type: "timeline", event });
          },
        });
        push({ type: "done", timeline });
      } catch (error) {
        push({
          type: "error",
          message: error instanceof Error ? error.message : "goal_execute_stream_failed",
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
