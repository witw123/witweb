/**
 * 登出 API（V1 版本）
 *
 * 作为版本化登出入口，复用共享登出处理器来清理认证 Cookie。
 *
 * @route /api/v1/auth/logout
 * @method POST - 处理用户登出
 */
import { handleLogoutPost } from "@/app/api/logout/shared";

export async function POST() {
  return handleLogoutPost();
}
