import { initDb } from "@/lib/db-init";
import { listChannels } from "@/lib/channel";

export async function GET() {
  initDb();
  return Response.json(listChannels());
}
