import { initDb } from "@/lib/db-init";
import { requireAuthUser } from "@/lib/http";
import { listCharacters } from "@/lib/video";

export async function GET() {
  initDb();
  const user = await requireAuthUser();
  if (user instanceof Response) return user;
  return Response.json({ characters: listCharacters(user) });
}
