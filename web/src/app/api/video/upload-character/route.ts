import { initDb } from "@/lib/db-init";
import { requireAuthUser } from "@/lib/http";
import { uploadCharacterTask } from "@/lib/studio";
import { createTask, updateTaskStatus } from "@/lib/video";

export async function POST(req: Request) {
  initDb();
  const user = await requireAuthUser();
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => ({}));
  if (!body?.url || String(body.url).trim() === "") {
    return Response.json({ detail: "url is required" }, { status: 400 });
  }
  const taskId = await uploadCharacterTask({
    url: String(body.url).trim(),
    timestamps: body.timestamps || "0,3",
    webHook: typeof body.webHook === "string" ? body.webHook : "-1",
    shutProgress: Boolean(body.shutProgress ?? false),
  });
  createTask(user, "upload_character", { url: body.url, timestamps: body.timestamps }, taskId);
  updateTaskStatus(taskId, "running", 0);
  return Response.json({ ok: true, task_id: taskId, id: taskId });
}
