import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { createVideoTask } from "@/lib/studio";
import { createTask, updateTaskStatus } from "@/lib/video";

export async function POST(req: Request) {
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const payload = {
    model: body.model || "sora-2",
    prompt: body.prompt,
    url: body.url,
    aspectRatio: body.aspectRatio,
    duration: body.duration,
    remixTargetId: body.remixTargetId,
    size: body.size || "small",
    webHook: "-1",
    shutProgress: false,
  };
  const taskId = await createVideoTask(payload);
  createTask(user, "generate", {
    prompt: payload.prompt,
    model: payload.model,
    url: payload.url,
    aspect_ratio: payload.aspectRatio,
    duration: payload.duration,
    remix_target_id: payload.remixTargetId,
    size: payload.size,
  }, taskId);
  updateTaskStatus(taskId, "running", 0);
  return Response.json({ ok: true, task_id: taskId });
}
