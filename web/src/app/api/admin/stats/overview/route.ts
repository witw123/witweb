import { initDb } from "@/lib/db-init";
import { requireAdminUser } from "@/lib/http";
import { statsOverview } from "@/lib/admin";

export async function GET() {
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;
  return Response.json(statsOverview());
}
