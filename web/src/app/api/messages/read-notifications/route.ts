/**
 */

import { markNotificationsAsRead } from "@/lib/blog";
import { getAuthUser } from "@/lib/http";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";

export const POST = withErrorHandler(async () => {
  // 验证用户认证
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  // 标记通知为已读
  markNotificationsAsRead(user);

  return successResponse({ ok: true });
});
