import { getAuthUser } from "@/lib/http";
import { getApiKeyCredits } from "@/lib/grsai";

export async function GET(_: Request, { params }: { params: { key: string } }) {
  const paramsData = await Promise.resolve(params);
    const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  const credits = await getApiKeyCredits(paramsData.key);
  return Response.json({ credits });
}
