import { createApiKey } from "@/lib/studio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return Response.json(await createApiKey({
    token: body.token,
    type: body.type || 0,
    name: body.name || "",
    credits: body.credits || 0,
    expireTime: body.expireTime || 0,
  }));
}
