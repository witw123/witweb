import { initDb } from "@/lib/db-init";
import { getChannelById } from "@/lib/channel";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const paramsData = await Promise.resolve(params);
    initDb();
  const row = getChannelById(Number(paramsData.id));
  if (!row) return Response.json({ detail: "Channel not found" }, { status: 404 });
  return Response.json(row);
}
