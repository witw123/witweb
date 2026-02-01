import { initDb } from "@/lib/db-init";
import { listServerMembers } from "@/lib/channel";

export async function GET(req: Request) {
  initDb();
  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get("server_id") ? parseInt(searchParams.get("server_id")!) : null;

  if (!serverId) {
    return Response.json([]);
  }

  const members = listServerMembers(serverId);
  return Response.json(members);
}
