import { initDb } from "@/lib/db-init";
import { requireAdminUser } from "@/lib/http";
import { setQueryDefaults } from "@/lib/studio";

export async function POST(req: Request) {
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => ({}));
  setQueryDefaults(body?.data || {});
  return Response.json({ ok: true });
}
