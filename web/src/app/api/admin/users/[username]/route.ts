import { initDb } from "@/lib/db-init";
import { requireAdminUser } from "@/lib/http";
import { getUserDetail, deleteUser } from "@/lib/admin";

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;
  const detail = getUserDetail(paramsData.username);
  if (!detail) return Response.json({ detail: "User not found" }, { status: 404 });
  return Response.json(detail);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;
  const admin = process.env.ADMIN_USERNAME || "witw";
  if (paramsData.username === admin) return Response.json({ detail: "Cannot delete admin" }, { status: 403 });
  deleteUser(paramsData.username);
  return Response.json({ ok: true });
}
