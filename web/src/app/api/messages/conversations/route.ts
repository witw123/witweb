/**
 */

import { messageRepository, userRepository } from "@/lib/repositories";
import { getAuthUser } from "@/lib/http";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  const conversations = messageRepository
    .getConversationList(user)
    .filter((item) => userRepository.existsByUsername(item.other_user.username));

  return successResponse(conversations);
});
