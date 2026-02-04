import { initDb } from "@/lib/db-init";
import { requireAuthUser } from "@/lib/http";
import { deleteVideo } from "@/lib/studio";

export async function POST(req: Request) {
  initDb();
  const user = await requireAuthUser();
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => ({}));
  deleteVideo(body.name);
  return Response.json({ ok: true });
}
