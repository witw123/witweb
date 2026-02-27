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

  const conversations = await messageRepository.getConversationList(user);
  const usernames = conversations.map((item) => item.other_user.username);
  const existingUsers = await userRepository.listBasicByUsernames(usernames);
  const existingUsernames = new Set(existingUsers.map((item) => item.username));
  const filtered = conversations.filter((item) => existingUsernames.has(item.other_user.username));

  return successResponse(filtered);
});
