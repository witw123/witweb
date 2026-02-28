import { headers } from "next/headers";
import { verifyJwtPayload } from "./jwt";
import { authConfig } from "./config";
import { AUTH_COOKIE_NAME } from "./auth-constants";
import { hasAdminAccess, normalizeRole, type AppRole } from "./rbac";

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
  const auth = await getAuthIdentity();
  return auth?.username || null;
}

export type AuthIdentity = {
  username: string;
  role: AppRole;
  rawRole?: string;
};

async function resolveTokenFromHeaders(): Promise<string | null> {
  const h = await headers();
  const authHeader = h.get("authorization") || "";
  let token: string | null = null;

  if (authHeader.toLowerCase().startsWith("bearer ")) {
    token = authHeader.slice(7);
  } else {
    token = getTokenFromCookie(h.get("cookie") || "");
  }
  return token;
}

export async function getAuthIdentity(): Promise<AuthIdentity | null> {
  const token = await resolveTokenFromHeaders();
  if (!token) return null;

  try {
    const payload = await verifyJwtPayload(token);
    const username = String(payload.sub || "").trim();
    if (!username) return null;
    const isLegacyAdmin = username === authConfig.adminUsername;
    const rawRole = typeof payload.role === "string" ? payload.role : undefined;
    return {
      username,
      role: normalizeRole(rawRole, isLegacyAdmin),
      rawRole,
    };
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
  const auth = await getAuthIdentity();
  if (!auth || !hasAdminAccess(auth.role)) {
    return Response.json({ detail: "Admin access required" }, { status: 403 });
  }
  return auth.username;
}
