/**
 * 认证 Cookie 工具
 *
 * 提供认证令牌的 Cookie 写入和清除功能。
 * 使用 HTTP-only cookie 存储 JWT 令牌，防止 XSS 攻击。
 *
 * @module auth-cookie
 */

import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";
import { appConfig } from "@/lib/config";

/** 认证 Cookie 默认有效期（秒）- 24小时 */
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24;

/**
 * 生成认证 Cookie 配置选项
 *
 * 根据环境配置适当的 Cookie 安全选项：
 * - 生产环境启用 secure 标志（HTTPS）
 * - 开发环境不启用 secure 标志
 *
 * @param {number} maxAge - Cookie 有效期（秒），默认 24 小时
 * @returns {object} Cookie 选项对象
 */
function authCookieOptions(maxAge = AUTH_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    secure: appConfig.isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * 设置认证 Cookie
 *
 * 将 JWT 令牌写入 HTTP 响应 Cookie 中。
 * Cookie 包含安全标志：HttpOnly（防止 XSS）、Secure（生产环境）、SameSite=Lax
 *
 * @param {NextResponse} response - Next.js 响应对象
 * @param {string} token - JWT 认证令牌
 * @returns {NextResponse} 添加 Cookie 后的响应对象
 *
 * @example
 * const response = NextResponse.json({ success: true });
 * setAuthCookie(response, token);
 * return response;
 */
export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions());
  return response;
}

/**
 * 清除认证 Cookie
 *
 * 通过将 Cookie 有效期设置为 0 来清除客户端的认证状态。
 *
 * @param {NextResponse} response - Next.js 响应对象
 * @returns {NextResponse} 清除 Cookie 后的响应对象
 *
 * @example
 * const response = NextResponse.redirect(new URL('/login', request.url));
 * clearAuthCookie(response);
 * return response;
 */
export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, "", authCookieOptions(0));
  return response;
}
