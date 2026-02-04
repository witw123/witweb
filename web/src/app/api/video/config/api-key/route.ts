import { initDb } from "@/lib/db-init";
import { requireAdminUser } from "@/lib/http";
import { setApiKey } from "@/lib/studio";

export async function POST(req: Request) {
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => ({}));
  setApiKey(body?.api_key || "");
  return Response.json({ ok: true });
}
