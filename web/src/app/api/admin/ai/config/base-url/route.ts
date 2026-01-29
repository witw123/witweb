import { getAuthUser } from "@/lib/http";
import { getApiBaseUrl, saveApiBaseUrl } from "@/lib/api-config";

export async function GET() {
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  return Response.json({ base_url: getApiBaseUrl() });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const baseUrl = (body?.base_url || "").trim();
  if (!baseUrl) return Response.json({ detail: "Base URL cannot be empty" }, { status: 400 });
  saveApiBaseUrl(baseUrl);
  return Response.json({ ok: true, message: "Base URL saved successfully" });
}
