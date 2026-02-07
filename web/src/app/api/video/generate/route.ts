import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { createVideoTask } from "@/lib/studio";
import { createTask, updateTaskStatus } from "@/lib/video";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const generateSchema = z.object({
  model: z.string().trim().optional(),
  prompt: z.string().trim().min(1, "prompt is required"),
  url: z.string().trim().optional(),
  aspectRatio: z.string().trim().optional(),
  duration: z.coerce.number().int().positive().optional(),
  remixTargetId: z.string().trim().optional(),
  size: z.string().trim().optional(),
  webHook: z.string().trim().optional(),
  shutProgress: z.boolean().optional(),
});

export const POST = withErrorHandler(async (req: Request) => {
  initDb();

  const user = await getAuthUser();
  if (!user) return errorResponses.unauthorized("Missing token");

  const body = await validateBody(req, generateSchema);
  const payload = {
    model: body.model || "sora-2",
    prompt: body.prompt,
    url: body.url,
    aspectRatio: body.aspectRatio || "9:16",
    duration: Number(body.duration || 10),
    remixTargetId: body.remixTargetId,
    size: body.size || "small",
    webHook: typeof body.webHook === "string" ? body.webHook : "-1",
    shutProgress: Boolean(body.shutProgress ?? false),
  };

  const taskId = await createVideoTask(payload);
  createTask(
    user,
    "generate",
    {
      prompt: payload.prompt,
      model: payload.model,
      url: payload.url,
      aspect_ratio: payload.aspectRatio,
      duration: payload.duration,
      remix_target_id: payload.remixTargetId,
      size: payload.size,
    },
    taskId
  );
  updateTaskStatus(taskId, "running", 0);

  return successResponse({ ok: true, task_id: taskId, id: taskId });
});
