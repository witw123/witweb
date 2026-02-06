/**
 */

import { getConversations } from "@/lib/messages";
import { getAuthUser } from "@/lib/http";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {
  // 楠岃瘉鐢ㄦ埛璁よ瘉
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  const conversations = getConversations(user);

  return successResponse(conversations);
});

