import { initDb } from "@/lib/db-init";

export async function GET() {
  initDb();
  return Response.json({ ok: true });
}
