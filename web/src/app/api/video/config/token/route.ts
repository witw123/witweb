import { initDb } from "@/lib/db-init";
import { requireAdminUser } from "@/lib/http";
import { setToken } from "@/lib/studio";

export async function POST(req: Request) {
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => ({}));
  setToken(body?.token || "");
  return Response.json({ ok: true });
}
