import { getAuthUser } from "@/lib/http";
import { createApiKey } from "@/lib/grsai";

export async function POST(req: Request) {
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const data = await createApiKey({
    name: body.name,
    type: body.type || 0,
    credits: body.credits || 0,
    expireTime: body.expireTime || 0,
  });
  return Response.json({ ok: true, data });
}
