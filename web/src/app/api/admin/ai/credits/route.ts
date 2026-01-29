import { getAuthUser } from "@/lib/http";
import { getCredits } from "@/lib/grsai";

export async function GET() {
  const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  const credits = await getCredits();
  return Response.json({ credits });
}
