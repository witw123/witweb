import { initDb } from "@/lib/db-init";
import { requireAuthUser } from "@/lib/http";
import { finalizeVideo } from "@/lib/studio";

export async function POST(req: Request) {
  initDb();
  const user = await requireAuthUser();
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => ({}));
  return Response.json(await finalizeVideo(body.id, body.prompt));
}
