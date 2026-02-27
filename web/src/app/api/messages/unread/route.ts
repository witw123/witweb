/**
 */

import { messageRepository, postRepository, userRepository, commentRepository } from "@/lib/repositories";
import { getAuthUser } from "@/lib/http";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  if (!user) {
    return successResponse({ unread_count: 0 });
  }

  try {
    const msgTotal = messageRepository.getTotalUnread(user);
    const profile = userRepository.findByUsername(user);
    const lastRead = profile?.last_read_notifications_at || "1970-01-01T00:00:00.000Z";
    const notifTotal =
      commentRepository.getNewCommentsCount(user, lastRead) +
      postRepository.getNewLikesCount(user, lastRead);
    return successResponse({ unread_count: msgTotal + notifTotal });
  } catch {
    return successResponse({ unread_count: 0 });
  }
});
