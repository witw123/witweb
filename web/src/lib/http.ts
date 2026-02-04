import { headers } from "next/headers";
import { verifyToken } from "./auth";

export async function getAuthUser() {
  const h = await headers();
  const auth = h.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7);
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export function isAdminUser(username: string | null | undefined): boolean {
  if (!username) return false;
  const adminUsername = process.env.ADMIN_USERNAME || "witw";
  return username === adminUsername;
}

export async function requireAuthUser(): Promise<string | Response> {
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Not authenticated" }, { status: 401 });
  return user;
}

export async function requireAdminUser(): Promise<string | Response> {
  const user = await getAuthUser();
  if (!isAdminUser(user)) return Response.json({ detail: "Admin access required" }, { status: 403 });
  return user as string;
}
