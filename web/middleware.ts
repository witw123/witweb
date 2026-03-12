import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "./src/lib/auth-constants";
import { verifyJwtPayload } from "./src/lib/jwt";
import { hasAdminAccess, normalizeRole } from "./src/lib/rbac";

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PUBLIC_WRITE_API_PATHS = new Set([
  "/api/login",
  "/api/register",
  "/api/v1/auth/login",
  "/api/v1/auth/register",
]);

function redirectToAdminLogin(req: NextRequest): NextResponse {
  const loginUrl = new URL("/admin/login", req.url);
  return NextResponse.redirect(loginUrl);
}

function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    return token || null;
  }
  return req.cookies.get(AUTH_COOKIE_NAME)?.value || null;
}

async function hasValidAuthToken(req: NextRequest): Promise<boolean> {
  const token = getTokenFromRequest(req);
  if (!token) return false;
  try {
    const payload = await verifyJwtPayload(token);
    return !!payload.sub;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  if (pathname.startsWith("/api/")) {
    if (READ_ONLY_METHODS.has(method) || PUBLIC_WRITE_API_PATHS.has(pathname)) {
      return NextResponse.next();
    }

    const authed = await hasValidAuthToken(req);
    if (!authed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "请先登录后再操作",
            code: "UNAUTHORIZED",
          },
        },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return redirectToAdminLogin(req);
  }

  try {
    const payload = await verifyJwtPayload(token);
    const adminUsername = process.env.ADMIN_USERNAME || "witw";
    const role = normalizeRole(typeof payload.role === "string" ? payload.role : undefined, payload.sub === adminUsername);
    const canAccessAdmin = hasAdminAccess(role);

    if (!payload.sub || !canAccessAdmin) {
      return redirectToAdminLogin(req);
    }

    return NextResponse.next();
  } catch {
    return redirectToAdminLogin(req);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
