import { setQueryDefaults } from "@/lib/studio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  setQueryDefaults(body?.data || {});
  return Response.json({ ok: true });
}
