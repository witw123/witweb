/**
 * HTTP 认证工具
 *
 * 提供服务端路由读取认证身份的轻量工具。
 * 这里统一兼容 Authorization Header 与 Cookie，两者都存在时优先使用 Bearer，
 * 方便 API 调试和浏览器会话共用同一套解析逻辑。
 */

import { headers } from "next/headers";
import { verifyJwtPayload } from "./jwt";
import { authConfig } from "./config";
import { AUTH_COOKIE_NAME } from "./auth-constants";
import { hasAdminAccess, normalizeRole, type AppRole } from "./rbac";

/**
 * 从 Cookie 中获取令牌
 *
 * 采用手动解析而不是依赖更重的 Cookie 工具，便于在任意请求上下文中复用。
 *
 * @param {string} cookieHeader - Cookie 头
 * @returns {string|null} 令牌字符串
 */
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

/**
 * 获取当前登录用户名
 *
 * 适合只关心“是谁”而不需要权限信息的多数业务路由。
 *
 * @returns {Promise<string|null>} 用户名，未登录返回 null
 */
export async function getAuthUser() {
  const auth = await getAuthIdentity();
  return auth?.username || null;
}

/**
 * 认证身份信息
 *
 * `rawRole` 保留 JWT 中的原始角色文本，用于排查迁移期角色映射问题。
 */
export type AuthIdentity = {
  username: string;
  role: AppRole;
  rawRole?: string;
};

/**
 * 从请求头中解析认证令牌
 *
 * 优先读取 Bearer Token，回退到 Cookie，确保脚本调用和浏览器调用共存。
 *
 * @returns {Promise<string | null>} 解析到的令牌
 */
async function resolveTokenFromHeaders(): Promise<string | null> {
  const h = await headers();
  const authHeader = h.get("authorization") || "";
  let token: string | null = null;

  if (authHeader.toLowerCase().startsWith("bearer ")) {
    token = authHeader.slice(7);
  } else {
    // 浏览器场景默认从认证 Cookie 中读取令牌。
    token = getTokenFromCookie(h.get("cookie") || "");
  }
  return token;
}

/**
 * 获取完整认证身份
 *
 * 该方法会完成 JWT 校验与角色归一化，是需要鉴权决策时的首选入口。
 *
 * @returns {Promise<AuthIdentity|null>} 认证身份信息
 */
export async function getAuthIdentity(): Promise<AuthIdentity | null> {
  const token = await resolveTokenFromHeaders();
  if (!token) return null;

  try {
    const payload = await verifyJwtPayload(token);
    const username = String(payload.sub || "").trim();
    if (!username) return null;
    // 兼容旧系统仍以固定管理员用户名表示高权限用户的历史约定。
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

/**
 * 判断用户名是否为配置中的系统管理员
 *
 * @param {string | null | undefined} username - 当前用户名
 * @returns {boolean} 是否命中管理员用户名
 */
export function isAdminUser(username: string | null | undefined): boolean {
  return !!username && username === authConfig.adminUsername;
}

/**
 * 强制要求当前请求已登录
 *
 * 返回值设计成 `string | Response`，便于老路由在最小改动下直接 `return`。
 *
 * @returns {Promise<string | Response>} 用户名或 401 响应
 */
export async function requireAuthUser(): Promise<string | Response> {
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Not authenticated" }, { status: 401 });
  return user;
}

/**
 * 强制要求当前请求具备管理员权限
 *
 * @returns {Promise<string | Response>} 管理员用户名或 403 响应
 */
export async function requireAdminUser(): Promise<string | Response> {
  const auth = await getAuthIdentity();
  if (!auth || !hasAdminAccess(auth.role)) {
    return Response.json({ detail: "Admin access required" }, { status: 403 });
  }
  return auth.username;
}
