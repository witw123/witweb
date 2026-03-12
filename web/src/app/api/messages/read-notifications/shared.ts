/**
 * 已读通知处理函数
 *
 * 将当前用户的所有未读通知标记为已读
 *
 * @route /api/messages/read-notifications
 * @method POST - 标记通知为已读
 */
import { userRepository } from "@/lib/repositories";
import { getAuthUser } from "@/lib/http";
import { errorResponses, successResponse } from "@/lib/api-response";

/**
 * 标记通知为已读
 *
 * 将当前登录用户的所有未读通知状态更新为已读
 *
 * @returns {Promise<Response>} 操作结果响应
 */
export async function buildReadNotificationsResponse(): Promise<Response> {
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  await userRepository.markNotificationsAsRead(user);

  return successResponse({ ok: true });
}
