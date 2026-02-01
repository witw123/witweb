import { initDb } from "@/lib/db-init";
import { listMessages, postMessage } from "@/lib/channel";
import { getAuthUser } from "@/lib/http";
import { processBotCommand } from "@/lib/bot";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const paramsData = await params;
  initDb();
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("page_size") || 50);
  return Response.json(listMessages(Number(paramsData.id), page, pageSize));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const content = (body?.content || "").trim();
  if (!content) return Response.json({ detail: "Missing content" }, { status: 400 });
  const message = postMessage(Number(paramsData.id), user, content);

  if (message) {
    // Fire and forget bot processing
    processBotCommand(Number(paramsData.id), content, user).catch(err => console.error(err));
  }

  if (!message) return Response.json({ detail: "User not found" }, { status: 404 });
  return Response.json(message);
}
