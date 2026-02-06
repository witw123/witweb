/**
 */

import { markNotificationsAsRead } from "@/lib/blog";
import { getAuthUser } from "@/lib/http";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";

export const POST = withErrorHandler(async () => {
  // 楠岃瘉鐢ㄦ埛璁よ瘉
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  // 鏍囪閫氱煡涓哄凡璇?
  markNotificationsAsRead(user);

  return successResponse({ ok: true });
});

