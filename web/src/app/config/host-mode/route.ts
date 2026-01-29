import { setHostMode } from "@/lib/studio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  setHostMode(body?.host_mode || "auto");
  return Response.json({ ok: true });
}
