import { getAuthUser } from "@/lib/http";
import { getModelStatus } from "@/lib/grsai";

export async function GET(_: Request, { params }: { params: { model: string } }) {
  const paramsData = await Promise.resolve(params);
    const user = await getAuthUser();
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (user !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });
  const data = await getModelStatus(paramsData.model);
  return Response.json({ status: data.status || false, error: data.error || "" });
}
