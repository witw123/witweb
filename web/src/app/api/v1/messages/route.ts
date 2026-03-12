/**
 * 私信消息 API
 *
 * 提供私信会话列表读取和消息发送入口。
 * GET 返回当前用户可见的会话列表；POST 在鉴权后写入一条新消息并返回会话 ID。
 *
 * @route /api/v1/messages
 * @method GET - 获取私信会话列表
 * @method POST - 发送私信
 */

import { NextRequest } from "next/server";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { verifyAuth } from "@/lib/auth";
import { errorResponses, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleMessageRepository, drizzleUserRepository } from "@/lib/repositories";
import { validateBody, z } from "@/lib/validate";
import { withErrorHandler } from "@/middleware/error-handler";

/** 发送消息请求体 Schema。 */
const sendMessageSchema = z.object({
  receiver: z.string().min(1, "接收方不能为空"),
  content: z.string().min(1, "消息内容不能为空").max(2000, "消息内容最多 2000 个字符"),
});

/**
 * 获取当前用户的会话列表
 *
 * 会过滤掉对方用户已不存在的会话，避免前端显示悬空对话。
 */
export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  const conversations = await drizzleMessageRepository.getConversationList(user);
  const usernames = conversations.map((item) => item.other_user.username);
  const existingUsers = await drizzleUserRepository.listBasicByUsernames(usernames);
  const existingUsernames = new Set(existingUsers.map((item) => item.username));
  const filtered = conversations.filter((item) => existingUsernames.has(item.other_user.username));

  return successResponse(filtered);
});

/**
 * 发送私信
 *
 * 鉴权成功后写入消息；如果接收方不存在，明确返回 404，便于前端区分输入错误和系统失败。
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await verifyAuth(req);
  if (!auth) {
    return errorResponses.unauthorized("请先登录");
  }

  const { receiver, content } = await validateBody(req, sendMessageSchema);

  try {
    const result = await drizzleMessageRepository.sendMessage({
      sender: auth.username,
      receiver,
      content,
    });
    return successResponse({ conversation_id: result.conversationId });
  } catch (error) {
    if (error instanceof ApiError && error.code === ErrorCode.USER_NOT_FOUND) {
      return errorResponses.notFound("接收方不存在");
    }

    const message = error instanceof Error ? error.message : "发送消息失败";
    return errorResponses.badRequest(message);
  }
});
