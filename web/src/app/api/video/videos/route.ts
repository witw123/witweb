import { initDb } from "@/lib/db-init";
import { requireAuthUser } from "@/lib/http";
import { getLocalVideos } from "@/lib/studio";

export async function GET() {
  initDb();
  const user = await requireAuthUser();
  if (user instanceof Response) return user;
  return Response.json(getLocalVideos());
}
