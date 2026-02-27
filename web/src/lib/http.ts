import { headers } from "next/headers";
import { verifyToken } from "./auth";
import { authConfig } from "./config";
import { AUTH_COOKIE_NAME } from "./auth-constants";

function getTokenFromCookie(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(";");
  for (const entry of cookies) {
    const [key, ...parts] = entry.trim().split("=");
    if (key === AUTH_COOKIE_NAME) {
      const value = parts.join("=");
      return value ? decodeURIComponent(value) : null;
    }
  }
  return null;
}

export async function getAuthUser() {
  const h = await headers();
  const auth = h.get("authorization") || "";
  let token: string | null = null;

  if (auth.toLowerCase().startsWith("bearer ")) {
    token = auth.slice(7);
  } else {
    token = getTokenFromCookie(h.get("cookie") || "");
  }

  if (!token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export function isAdminUser(username: string | null | undefined): boolean {
  return !!username && username === authConfig.adminUsername;
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
