import { initDb } from "@/lib/db-init";
import { requireAdminUser } from "@/lib/http";
import { listBlogs } from "@/lib/admin";

export async function GET(req: Request) {
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") || 1);
  const limit = Number(url.searchParams.get("limit") || 20);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const username = url.searchParams.get("username") || "";
  const sort = url.searchParams.get("sort") || "created_at_desc";
  return Response.json(listBlogs(page, limit, search, status, username, sort));
}
