import { initDb } from "@/lib/db-init";
import { publicProfile } from "@/lib/user";
import { getAuthUser } from "@/lib/http";

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const paramsData = await params;
  initDb();
  const viewer = await getAuthUser();
  const profile = publicProfile(paramsData.username, viewer || undefined);
  if (!profile) return Response.json({ detail: "User not found" }, { status: 404 });
  return Response.json(profile);
}
