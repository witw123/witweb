import { initDb } from "@/lib/db-init";
import { requireAuthUser } from "@/lib/http";
import { createVideoTask } from "@/lib/studio";
import { createTask, updateTaskStatus } from "@/lib/video";

export async function POST(req: Request) {
  initDb();
  const user = await requireAuthUser();
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => ({}));
  if (!body?.prompt || String(body.prompt).trim() === "") {
    return Response.json({ detail: "prompt is required" }, { status: 400 });
  }
  const payload = {
    model: body.model || "sora-2",
    prompt: String(body.prompt).trim(),
    url: body.url,
    aspectRatio: body.aspectRatio || "9:16",
    duration: Number(body.duration || 10),
    remixTargetId: body.remixTargetId,
    size: body.size || "small",
    webHook: typeof body.webHook === "string" ? body.webHook : "-1",
    shutProgress: Boolean(body.shutProgress ?? false),
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
  return Response.json({ ok: true, task_id: taskId, id: taskId });
}
