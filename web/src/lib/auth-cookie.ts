import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";
import { appConfig } from "@/lib/config";

const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24;

function authCookieOptions(maxAge = AUTH_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    secure: appConfig.isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions());
  return response;
}

export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, "", authCookieOptions(0));
  return response;
}
