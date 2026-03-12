/**
 * 消息通知 API
 *
 * 获取用户的消息通知列表
 *
 * @route /api/v1/messages/notifications
 * @method GET - 获取通知列表
 */

import { NextRequest } from "next/server";
import { withErrorHandler } from "@/middleware/error-handler";
import { buildNotificationsResponse } from "../../../messages/notifications/shared";

export const GET = withErrorHandler(async (req: NextRequest) => buildNotificationsResponse(req));
