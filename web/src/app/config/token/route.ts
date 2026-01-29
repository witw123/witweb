import { setToken } from "@/lib/studio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  setToken(body?.token || "");
  return Response.json({ ok: true });
}
