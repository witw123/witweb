/**
 * 安全中间件模块
 *
 * 提供 API 安全相关的中间件功能，包括：
 * - 速率限制（IP 级别和登录限流）
 * - 请求验证中间件
 * - 认证和授权中间件
 * - 安全上下文创建
 * - 安全响应构建
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

/** 安全上下文 */
export interface SecurityContext {
  /** 客户端 IP 地址 */
  ip: string;
  /** 用户代理字符串 */
  userAgent?: string;
  /** 已认证用户名 */
  user?: string;
  /** 是否已认证 */
  isAuthenticated: boolean;
}

/**
 * 获取客户端真实 IP 地址
 *
 * 优先从 X-Forwarded-For、X-Real-IP 头获取，fallback 到 request.ip
 *
 * @param req - Next.js 请求对象
 * @returns 客户端 IP 地址
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
 * 创建带安全响应头的响应
 *
 * 自动添加安全响应头到响应中
 *
 * @param body - 响应体
 * @param init - 响应初始化选项
 * @returns 带安全头的 Response 对象
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
 * 创建带安全头的 JSON 响应
 *
 * 快捷方法：创建 application/json 响应的同时添加安全头
 *
 * @param data - 要序列化为 JSON 的数据
 * @param status - HTTP 状态码（默认 200）
 * @param additionalHeaders - 额外的响应头
 * @returns 带安全头的 JSON Response
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
 * 速率限制中间件
 *
 * 基于 IP 地址的请求频率限制，超限时返回 429 状态码
 *
 * @param req - Next.js 请求对象
 * @param maxRequests - 最大请求数（可选）
 * @param windowMs - 时间窗口（毫秒，可选）
 * @returns 超限返回错误 Response，否则返回 null 继续处理
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
 * API 速率限制中间件
 *
 * 使用配置的默认 API 限流参数
 *
 * @param req - Next.js 请求对象
 * @returns 超限返回错误 Response，否则返回 null
 */
export function apiRateLimit(req: NextRequest): Response | null {
  return rateLimitMiddleware(
    req,
    securityConfig.apiRateLimitMax,
    securityConfig.rateLimitWindow
  );
}

/**
 * 登录速率限制中间件
 *
 * 专门针对登录接口的限流，防止暴力破解
 *
 * @param req - Next.js 请求对象
 * @returns 超限返回错误 Response，否则返回 null
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
 * 请求体验证中间件
 *
 * 使用安全模块的验证规则验证请求体
 *
 * @template T - 请求体类型
 * @param body - 待验证的请求体数据
 * @param rules - 验证规则
 * @returns 验证通过返回数据和 valid: true，否则返回错误和 valid: false
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
 * 认证中间件
 *
 * 验证请求是否已登录，未登录返回 401 错误
 *
 * @param req - Next.js 请求对象
 * @returns 已认证返回用户名，未认证返回 401 Response
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
 * 管理员认证中间件
 *
 * 验证请求是否具有管理员权限
 *
 * @param req - Next.js 请求对象
 * @returns 有权限返回用户名，无权限返回对应错误 Response
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
 * 创建安全上下文
 *
 * 从请求中提取安全相关信息，构建安全上下文对象
 *
 * @param req - Next.js 请求对象
 * @returns 安全上下文对象
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
 * 安全日志记录
 *
 * 记录安全相关事件到日志，包含时间戳、IP、用户等信息
 *
 * @param event - 事件名称
 * @param context - 安全上下文
 * @param details - 额外详细信息
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
 * 执行中间件链
 *
 * 依次执行多个中间件，返回第一个非 null 结果
 *
 * @param req - Next.js 请求对象
 * @param middlewares - 中间件函数数组
 * @returns 第一个返回非 null 的中间件结果，或 null
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
