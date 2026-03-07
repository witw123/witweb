import { commentRepository, drizzlePostRepository, messageRepository, userRepository } from "@/lib/repositories";
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";

export async function buildUnreadResponse(): Promise<Response> {
  const user = await getAuthUser();
  if (!user) {
    return successResponse({ unread_count: 0 });
  }

  try {
    const msgTotal = await messageRepository.getTotalUnread(user);
    const profile = await userRepository.findByUsername(user);
    const lastRead = profile?.last_read_notifications_at || "1970-01-01T00:00:00.000Z";
    const notifTotal =
      (await commentRepository.getNewCommentsCount(user, lastRead)) +
      (await drizzlePostRepository.getNewLikesCount(user, lastRead));

    return successResponse({ unread_count: msgTotal + notifTotal });
  } catch {
    return successResponse({ unread_count: 0 });
  }
}
