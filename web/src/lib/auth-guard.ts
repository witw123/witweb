/**
 * 认证请求防护工具
 *
 * 提供认证相关请求的安全防护功能：
 * - 请求体大小限制：防止大体积请求攻击
 * - 速率限制：防止暴力破解和滥用
 * - 失败延迟：增加暴力破解的时间成本
 *
 * @module auth-guard
 */

import { ApiError, ErrorCode } from "@/lib/api-error";
import { authConfig, securityConfig } from "@/lib/config";
import { checkRateLimit } from "@/lib/security";

/** 认证请求最大允许的 Body 大小（字节）- 16KB */
const AUTH_REQUEST_MAX_BYTES = 16 * 1024;

/**
 * 获取客户端真实 IP 地址
 *
 * 从请求头中提取客户端 IP，支持代理场景。
 *
 * @param {Request} req - HTTP 请求对象
 * @returns {string} 客户端 IP 地址，未知时返回 "unknown"
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * 标准化用户名作为限流 key
 *
 * 统一用户名格式以确保限流 key 的一致性：
 * - 去除首尾空白
 * - 转换为小写
 *
 * @param {string} username - 用户名
 * @returns {string} 标准化后的用户名
 */
function normalizeUserKey(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * 验证认证请求体大小
 *
 * 检查请求的 Content-Length 是否超过允许的最大值（16KB）。
 * 防止过大的请求体导致服务器资源耗尽。
 *
 * @param {Request} req - HTTP 请求对象
 * @returns {void}
 * @throws {ApiError} 当请求体过大时抛出 400 错误
 */
export function assertAuthPayloadSize(req: Request): void {
  const header = req.headers.get("content-length");
  if (!header) return;
  const size = Number(header);
  if (!Number.isFinite(size) || size < 0) return;
  if (size > AUTH_REQUEST_MAX_BYTES) {
    throw ApiError.badRequest("Request payload too large");
  }
}

/**
 * 验证认证请求速率限制
 *
 * 对登录和注册操作进行双重限流：
 * 1. IP 级别限流：同一 IP 在时间窗口内的最大请求数
 * 2. 用户级别限流：同一用户名在时间窗口内的最大请求数
 *
 * 登录和注册的限流配置不同：
 * - 登录：maxLoginAttempts 次/窗口
 * - 注册：maxLoginAttempts * 2 次/窗口（注册通常更宽松）
 *
 * @param {Request} req - HTTP 请求对象
 * @param {"login" | "register"} action - 认证操作类型
 * @param {string} [username] - 用户名（可选，用于用户级别限流）
 * @returns {void}
 * @throws {ApiError} 当超过限流阈值时抛出 429 错误
 */
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

/**
 * 认证失败延迟
 *
 * 在认证失败后增加随机延迟（180-400ms），防止暴力破解。
 * 延迟时间包含随机抖动，使攻击者无法通过响应时间推断有效凭据。
 * 这是防御暴力破解的常用技术（timing attack 防护）。
 *
 * @returns {Promise<void>} 延迟完成后的 Promise
 *
 * @example
 * // 登录失败后调用
 * const isValid = await verifyPassword(inputPassword, storedHash);
 * if (!isValid) {
 *   await delayFailedAuth();
 *   return Response.json({ error: '密码错误' }, { status: 401 });
 * }
 */
export async function delayFailedAuth(): Promise<void> {
  const jitterMs = 180 + Math.floor(Math.random() * 220);
  await new Promise((resolve) => setTimeout(resolve, jitterMs));
}
