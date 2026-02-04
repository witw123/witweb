import { initDb } from "@/lib/db-init";
import { requireAuthUser } from "@/lib/http";
import { getTask, pollAndUpdate } from "@/lib/video";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await requireAuthUser();
  if (user instanceof Response) return user;
  let task = getTask(paramsData.id, user);
  if (!task) return Response.json({ detail: "Task not found" }, { status: 404 });
  if (task.status === "pending" || task.status === "running") {
    try {
      await pollAndUpdate(paramsData.id);
      task = getTask(paramsData.id, user);
    } catch {}
  }
  return Response.json(task);
}
