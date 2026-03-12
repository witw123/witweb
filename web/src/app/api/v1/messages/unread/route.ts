/**
 * 获取未读消息数量
 *
 * 返回当前用户未读消息的数量统计
 *
 * @route /api/v1/messages/unread
 * @method GET - 获取未读消息数量
 * @returns {Promise<Object>} 未读消息数量 { unread: number }
 */
import { withErrorHandler } from "@/middleware/error-handler";
import { buildUnreadResponse } from "../../../messages/unread/shared";

export const GET = withErrorHandler(async () => buildUnreadResponse());
