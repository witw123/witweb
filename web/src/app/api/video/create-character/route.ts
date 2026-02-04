import { initDb } from "@/lib/db-init";
import { requireAuthUser } from "@/lib/http";
import { createCharacterTask } from "@/lib/studio";
import { createTask, updateTaskStatus } from "@/lib/video";

export async function POST(req: Request) {
  initDb();
  const user = await requireAuthUser();
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => ({}));
  if (!body?.pid || String(body.pid).trim() === "") {
    return Response.json({ detail: "pid is required" }, { status: 400 });
  }
  const taskId = await createCharacterTask({
    pid: String(body.pid).trim(),
    timestamps: body.timestamps || "0,3",
    webHook: typeof body.webHook === "string" ? body.webHook : "-1",
    shutProgress: Boolean(body.shutProgress ?? false),
  });
  createTask(user, "create_character", { pid: body.pid, timestamps: body.timestamps }, taskId);
  updateTaskStatus(taskId, "running", 0);
  return Response.json({ ok: true, task_id: taskId, id: taskId });
}
