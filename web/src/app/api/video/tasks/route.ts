import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { listTasks } from "@/lib/video";

export async function GET(req: Request) {
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Not authenticated" }, { status: 401 });
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") || 1);
  const limit = Number(url.searchParams.get("limit") || 20);
  const taskType = url.searchParams.get("task_type") || undefined;
  return Response.json(listTasks(user, page, limit, taskType || undefined));
}
