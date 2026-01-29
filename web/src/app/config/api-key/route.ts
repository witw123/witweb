import { setApiKey } from "@/lib/studio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  setApiKey(body?.api_key || "");
  return Response.json({ ok: true });
}
