import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { createCharacterTask } from "@/lib/studio";
import { createTask, updateTaskStatus } from "@/lib/video";

export async function POST(req: Request) {
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const taskId = await createCharacterTask({
    pid: body.pid,
    timestamps: body.timestamps || "0,3",
    webHook: "-1",
    shutProgress: false,
  });
  createTask(user, "create_character", { pid: body.pid, timestamps: body.timestamps }, taskId);
  updateTaskStatus(taskId, "running", 0);
  return Response.json({ ok: true, task_id: taskId });
}
