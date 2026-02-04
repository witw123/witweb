import { initDb } from "@/lib/db-init";
import { requireAuthUser } from "@/lib/http";
import { removeActiveTask } from "@/lib/studio";

export async function POST(req: Request) {
  initDb();
  const user = await requireAuthUser();
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => ({}));
  removeActiveTask(body.id);
  return Response.json({ ok: true });
}
