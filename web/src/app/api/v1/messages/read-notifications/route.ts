/**
 * 获取已读通知列表
 *
 * 返回当前用户已读的消息通知列表
 *
 * @route /api/v1/messages/read-notifications
 * @method POST - 获取已读通知列表
 * @returns {Promise<Object>} 已读通知列表
 */
import { withErrorHandler } from "@/middleware/error-handler";
import { buildReadNotificationsResponse } from "../../../messages/read-notifications/shared";

export const POST = withErrorHandler(async () => buildReadNotificationsResponse());
