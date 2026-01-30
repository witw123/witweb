import { getCredits, getConfig } from "@/lib/studio";

export async function GET() {
  const cfg = getConfig() as { token?: string };
  const token = cfg.token || "";
  if (!token) return Response.json({ credits: null, error: "missing token" });
  try {
    return Response.json(await getCredits(token));
  } catch (e: any) {
    return Response.json({ credits: null, error: String(e) });
  }
}
