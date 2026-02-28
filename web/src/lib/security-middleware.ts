/**
 */

import { NextRequest } from "next/server";
import { 
  getSecurityHeaders, 
  checkRateLimit, 
  validateRequest,
  ValidationError 
} from "./security";
import { securityConfig } from "./config";
import { getAuthIdentity, getAuthUser } from "./http";
import { hasAdminAccess } from "./rbac";

export interface SecurityContext {
  ip: string;
  userAgent?: string;
  user?: string;
  isAuthenticated: boolean;
}

/**
 */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  
  const requestWithIp = req as NextRequest & { ip?: string };
  return requestWithIp.ip || "unknown";
}

/**
 */
export function createSecureResponse(
  body: BodyInit | null,
  init?: ResponseInit
): Response {
  const headers = new Headers(init?.headers);
  
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  return new Response(body, {
    ...init,
    headers,
  });
}

/**
 */
export function createJsonResponse(
  data: unknown,
  status: number = 200,
  additionalHeaders?: Record<string, string>
): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    ...additionalHeaders,
  });
  
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  return Response.json(data, { status, headers });
}

/**
 */
export function rateLimitMiddleware(
  req: NextRequest,
  maxRequests?: number,
  windowMs?: number
): Response | null {
  const ip = getClientIp(req);
  const max = maxRequests ?? securityConfig.rateLimitMax;
  const window = windowMs ?? securityConfig.rateLimitWindow;
  
  const result = checkRateLimit(`rate_limit:${ip}`, max, window);
  
  if (!result.allowed) {
    const headers = new Headers(getSecurityHeaders());
    headers.set("Retry-After", String(Math.ceil((result.resetTime - Date.now()) / 1000)));
    headers.set("X-RateLimit-Limit", String(max));
    headers.set("X-RateLimit-Remaining", "0");
    headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetTime / 1000)));
    
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        message: "Too many requests, please try again later",
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers,
      }
    );
  }
  
  req.headers.set("X-RateLimit-Limit", String(max));
  req.headers.set("X-RateLimit-Remaining", String(result.remaining));
  req.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetTime / 1000)));
  
  return null;
}

/**
 */
export function apiRateLimit(req: NextRequest): Response | null {
  return rateLimitMiddleware(
    req,
    securityConfig.apiRateLimitMax,
    securityConfig.rateLimitWindow
  );
}

/**
 */
export function loginRateLimit(req: NextRequest): Response | null {
  const ip = getClientIp(req);
  const result = checkRateLimit(
    `login_limit:${ip}`,
    securityConfig.loginRateLimitMax,
    securityConfig.rateLimitWindow
  );
  
  if (!result.allowed) {
    const headers = new Headers(getSecurityHeaders());
    headers.set("Retry-After", String(Math.ceil((result.resetTime - Date.now()) / 1000)));
    
    return new Response(
      JSON.stringify({
        error: "Too many login attempts",
        message: "Please try again later",
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers,
      }
    );
  }
  
  return null;
}

/**
 */
export function validateRequestMiddleware<T extends Record<string, unknown>>(
  body: unknown,
  rules: Parameters<typeof validateRequest<T>>[1]
): 
  | { valid: true; data: T; errors?: undefined }
  | { valid: false; data?: undefined; errors: ValidationError[]; response: Response } {
  const result = validateRequest<T>(body, rules);
  
  if (!result.valid) {
    return {
      valid: false,
      errors: result.errors!,
      response: createJsonResponse(
        {
          error: "Validation failed",
          details: result.errors,
        },
        400
      ),
    };
  }
  
  return { valid: true, data: result.data! };
}

/**
 */
export async function authMiddleware(req: NextRequest): Promise<string | Response> {
  void req;
  const user = await getAuthUser();
  
  if (!user) {
    return createJsonResponse(
      {
        error: "Unauthorized",
        message: "Authentication required",
      },
      401
    );
  }
  
  return user;
}

/**
 */
export async function adminAuthMiddleware(req: NextRequest): Promise<string | Response> {
  void req;
  const auth = await getAuthIdentity();
  const user = auth?.username || null;
  
  if (!user) {
    return createJsonResponse(
      {
        error: "Unauthorized",
        message: "Authentication required",
      },
      401
    );
  }
  
  if (!auth || !hasAdminAccess(auth.role)) {
    return createJsonResponse(
      {
        error: "Forbidden",
        message: "Admin access required",
      },
      403
    );
  }
  
  return user;
}

/**
 */
export async function createSecurityContext(req: NextRequest): Promise<SecurityContext> {
  const user = await getAuthUser();
  
  return {
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent") || undefined,
    user: user || undefined,
    isAuthenticated: !!user,
  };
}

/**
 */
export function securityLog(
  event: string,
  context: SecurityContext,
  details?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    ip: context.ip,
    user: context.user,
    userAgent: context.userAgent,
    ...details,
  };
  
  if (process.env.NODE_ENV === "production") {
    console.log("[SECURITY]", JSON.stringify(logEntry));
  } else {
    console.log("[SECURITY]", event, { ip: context.ip, user: context.user, ...details });
  }
}

/**
 */
export async function executeMiddlewares(
  req: NextRequest,
  middlewares: Array<(req: NextRequest) => Response | null | Promise<Response | null>>
): Promise<Response | null> {
  for (const middleware of middlewares) {
    const result = await middleware(req);
    if (result) {
      return result;
    }
  }
  return null;
}
