/**
 * Unread Count API - 未读消息计数数据处理
 *
 * 提供获取用户未读消息和通知总数的功能
 * 统计未读私信数和新增评论/点赞通知数
 */

import { commentRepository, drizzlePostRepository, messageRepository, userRepository } from "@/lib/repositories";
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";

/**
 * 构建未读计数 GET 响应
 *
 * 获取当前用户未读的私信和通知总数
 * 未登录用户返回 0
 *
 * @returns {Promise<Response>} 未读计数响应，包含未读消息总数
 */
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
