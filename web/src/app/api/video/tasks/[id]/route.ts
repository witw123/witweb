import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { getTask, pollAndUpdate } from "@/lib/video";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const paramsData = await Promise.resolve(params);
    initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Not authenticated" }, { status: 401 });
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
