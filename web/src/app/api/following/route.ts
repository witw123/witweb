import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { listFollowing } from "@/lib/follow";

export async function GET(req: Request) {
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") || 1);
  const size = Number(url.searchParams.get("size") || 20);
  const q = url.searchParams.get("q") || "";
  return Response.json(listFollowing(user, page, size, q));
}
