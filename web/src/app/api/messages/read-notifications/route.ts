/**
 */

import { userRepository } from "@/lib/repositories";
import { getAuthUser } from "@/lib/http";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";

export const POST = withErrorHandler(async () => {
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  userRepository.markNotificationsAsRead(user);

  return successResponse({ ok: true });
});
