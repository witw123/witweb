import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "./src/lib/auth-constants";
import { verifyJwtPayload } from "./src/lib/jwt";

function redirectToAdminLogin(req: NextRequest): NextResponse {
  const loginUrl = new URL("/admin/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return redirectToAdminLogin(req);
  }

  try {
    const payload = await verifyJwtPayload(token);
    const adminUsername = process.env.ADMIN_USERNAME || "witw";
    const isAdminByRole = payload.role === "admin";
    const isAdminByLegacyName = payload.sub === adminUsername;

    if (!payload.sub || (!isAdminByRole && !isAdminByLegacyName)) {
      return redirectToAdminLogin(req);
    }

    return NextResponse.next();
  } catch {
    return redirectToAdminLogin(req);
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
