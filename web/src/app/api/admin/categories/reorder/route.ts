import { initDb } from "@/lib/db-init";
import { requireAdminUser } from "@/lib/http";
import { reorderCategories } from "@/lib/admin";

export async function POST(req: Request) {
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v)) : [];
  if (!ids.length) {
    return Response.json({ detail: "ids 不能为空" }, { status: 400 });
  }
  reorderCategories(ids);
  return Response.json({ ok: true });
}

