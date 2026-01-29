import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { listCharacters } from "@/lib/video";

export async function GET() {
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Not authenticated" }, { status: 401 });
  return Response.json({ characters: listCharacters(user) });
}
