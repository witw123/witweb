/**
 * Logout API - 用户登出数据处理
 *
 * 提供用户登出功能
 * 清除认证 Cookie，使令牌失效
 */

import { successResponse } from "@/lib/api-response";
import { clearAuthCookie } from "@/lib/auth-cookie";

/**
 * 处理用户登出 POST 请求
 *
 * 清除 HTTP-only 认证 Cookie，使当前会话失效
 *
 * @returns {Promise<Response>} 登出结果响应
 */
export async function handleLogoutPost() {
  return clearAuthCookie(successResponse({ ok: true }));
}
