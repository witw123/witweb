import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { initDb } from "@/lib/db-init";
import { AGENT_MODELS, generateAgentDraft } from "@/lib/agent-llm";
import { createRunRecord, finalizeRunFromDraft, markRunFailed } from "@/lib/agent";

const bodySchema = z.object({
  agent_type: z.enum(["topic", "writing", "publish"]),
  model: z.enum(AGENT_MODELS).default("gemini-3-pro"),
  goal: z.string().trim().min(3, "目标至少 3 个字符"),
});

function streamLine(obj: unknown) {
  return `${JSON.stringify(obj)}\n`;
}

export const POST = withErrorHandler(async (req) => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);
  const body = await validateBody(req, bodySchema);
  const model = body.model ?? "gemini-3-pro";

  const runId = createRunRecord(user, body.goal, body.agent_type, model);
  const encoder = new TextEncoder();
  let chunkCount = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (payload: unknown) => controller.enqueue(encoder.encode(streamLine(payload)));
      try {
        push({ type: "run_created", run_id: runId, status: "running" });
        push({ type: "stage", key: "research", title: "主题研究", status: "running" });
        push({ type: "stage", key: "research", title: "主题研究", status: "done" });
        push({ type: "stage", key: "outline", title: "大纲生成", status: "running" });

        const draft = await generateAgentDraft(body.goal, body.agent_type, {
          model,
          onChunk: (chunk) => {
            chunkCount += 1;
            // Throttle chunk events to avoid flooding the UI.
            if (chunkCount % 6 === 0) {
              push({ type: "delta", kind: "model", text: chunk });
            }
          },
        });

        push({ type: "stage", key: "outline", title: "大纲生成", status: "done" });
        push({ type: "stage", key: "draft", title: "正文生成", status: "done" });
        push({ type: "stage", key: "seo", title: "SEO 生成", status: "done" });
        push({ type: "artifact", kind: "title", content: draft.title });
        push({ type: "artifact", kind: "tags", content: draft.tags });
        push({ type: "artifact", kind: "content", content: draft.content.slice(0, 900) });
        push({ type: "artifact", kind: "seo", content: JSON.stringify(draft.seo) });

        finalizeRunFromDraft(runId, body.goal, body.agent_type, draft);

        push({ type: "done", run_id: runId, status: "done" });
      } catch (error) {
        markRunFailed(runId, error instanceof Error ? error.message : "unknown_error");
        push({
          type: "error",
          run_id: runId,
          code:
            error && typeof error === "object" && "code" in error
              ? String((error as { code: unknown }).code)
              : "EXTERNAL_SERVICE_ERROR",
          message: error instanceof Error ? error.message : "生成失败",
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
