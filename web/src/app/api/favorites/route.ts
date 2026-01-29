import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { listFavorites } from "@/lib/blog";

export async function GET(req: Request) {
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") || 1);
  const size = Number(url.searchParams.get("size") || 10);
  const data = listFavorites(user, page, size);
  return Response.json(data);
}
