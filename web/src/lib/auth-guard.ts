import { ApiError, ErrorCode } from "@/lib/api-error";
import { authConfig, securityConfig } from "@/lib/config";
import { checkRateLimit } from "@/lib/security";

const AUTH_REQUEST_MAX_BYTES = 16 * 1024;

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function normalizeUserKey(username: string): string {
  return username.trim().toLowerCase();
}

export function assertAuthPayloadSize(req: Request): void {
  const header = req.headers.get("content-length");
  if (!header) return;
  const size = Number(header);
  if (!Number.isFinite(size) || size < 0) return;
  if (size > AUTH_REQUEST_MAX_BYTES) {
    throw ApiError.badRequest("Request payload too large");
  }
}

export function assertAuthRateLimit(req: Request, action: "login" | "register", username?: string): void {
  const ip = getClientIp(req);
  const windowMs = securityConfig.loginRateLimitWindow;
  const maxPerIp = action === "login" ? authConfig.maxLoginAttempts : Math.max(10, authConfig.maxLoginAttempts * 2);
  const ipResult = checkRateLimit(`auth:${action}:ip:${ip}`, maxPerIp, windowMs);
  if (!ipResult.allowed) {
    throw new ApiError(ErrorCode.TOO_MANY_REQUESTS, "Too many requests, please try again later.");
  }

  if (username?.trim()) {
    const key = normalizeUserKey(username);
    const maxPerUser = action === "login" ? authConfig.maxLoginAttempts : Math.max(8, authConfig.maxLoginAttempts);
    const userResult = checkRateLimit(`auth:${action}:user:${key}`, maxPerUser, windowMs);
    if (!userResult.allowed) {
      throw new ApiError(ErrorCode.TOO_MANY_REQUESTS, "Too many requests, please try again later.");
    }
  }
}

export async function delayFailedAuth(): Promise<void> {
  const jitterMs = 180 + Math.floor(Math.random() * 220);
  await new Promise((resolve) => setTimeout(resolve, jitterMs));
}
