import { initDb } from "@/lib/db-init";
import { createChannel, listChannels } from "@/lib/channel";

export async function GET() {
  initDb();
  return Response.json(listChannels());
}


export async function POST(req: Request) {
  initDb();
  const { getAuthUser } = await import("@/lib/http");
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = body?.name || "";
  const description = body?.description || "";
  const res = createChannel(name, description);
  if (!res.ok) {
    const detail = res.error === "exists" ? "Channel already exists" : "Name required";
    return Response.json({ detail }, { status: 400 });
  }
  return Response.json(res.channel);
}
