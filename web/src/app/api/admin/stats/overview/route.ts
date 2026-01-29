import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { statsOverview } from "@/lib/admin";

export async function GET() {
  initDb();
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  return Response.json(statsOverview());
}
