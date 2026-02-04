import { initDb } from "@/lib/db-init";
import { requireAuthUser } from "@/lib/http";
import { getHistory } from "@/lib/studio";

export async function GET() {
  initDb();
  const user = await requireAuthUser();
  if (user instanceof Response) return user;
  return Response.json(getHistory());
}
