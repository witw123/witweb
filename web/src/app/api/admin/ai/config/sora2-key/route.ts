import { getAuthUser } from "@/lib/http";
import { getSora2Key, saveSora2Key } from "@/lib/api-config";

export async function GET() {
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  const key = getSora2Key();
  const preview = key ? `${key.slice(0,4)}...${key.slice(-4)}` : null;
  return Response.json({ has_token: !!key, token_preview: preview });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const key = (body?.token || "").trim();
  if (!key) return Response.json({ detail: "API Key cannot be empty" }, { status: 400 });
  saveSora2Key(key);
  return Response.json({ ok: true, message: "Sora2 API Key saved successfully" });
}
