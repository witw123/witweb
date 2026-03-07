import { NextResponse } from "next/server";

/**
 * Add deprecation headers to a legacy API response.
 */
export function withDeprecation(
  response: NextResponse,
  successorPath: string,
  sunsetDate: string = "Sat, 01 Jan 2027 00:00:00 GMT",
): NextResponse {
  response.headers.set("Deprecation", "true");
  response.headers.set("Sunset", sunsetDate);
  response.headers.set("Link", `<${successorPath}>; rel="successor-version"`);

  if (process.env.NODE_ENV !== "test") {
    console.warn(
      `[DEPRECATED] This API endpoint is deprecated. Please migrate to ${successorPath}`,
    );
  }

  return response;
}

/**
 * Legacy API routes that still expose a documented successor.
 */
export const DEPRECATED_ROUTES: Record<string, string> = {
  "/api/login": "/api/v1/auth/login",
  "/api/logout": "/api/v1/auth/logout",
  "/api/register": "/api/v1/auth/register",
  "/api/upload": "/api/v1/upload",
  "/api/favorites": "/api/v1/favorites",
  "/api/messages": "/api/v1/messages",
};
