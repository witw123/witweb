import { getAuthUser } from "@/lib/http";
import { saveApiToken, getApiToken } from "@/lib/api-config";

export async function GET() {
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  const token = getApiToken();
  const preview = token ? `${token.slice(0,4)}...${token.slice(-4)}` : null;
  return Response.json({ has_token: !!token, token_preview: preview });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const token = (body?.token || "").trim();
  if (!token) return Response.json({ detail: "Token cannot be empty" }, { status: 400 });
  saveApiToken(token);
  return Response.json({ ok: true, message: "Token saved successfully" });
}
