/**
 * 登出 API（旧版）
 *
 * 处理用户登出请求，已废弃，请使用 /api/v1/auth/logout
 *
 * @route /api/logout
 * @method POST - 处理用户登出
 */
import { withDeprecation } from "@/lib/deprecation";
import { handleLogoutPost } from "@/app/api/logout/shared";

export async function POST() {
  return withDeprecation(await handleLogoutPost(), "/api/v1/auth/logout");
}
