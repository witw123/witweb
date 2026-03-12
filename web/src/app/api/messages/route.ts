/**
 * 消息列表与发送 API
 *
 * 提供消息会话列表查询和发送私信功能
 *
 * @route /api/messages
 * @method GET - 获取当前用户的消息会话列表
 * @method POST - 发送私信给其他用户
 */
import { NextRequest } from "next/server";
import { messageRepository, userRepository } from "@/lib/repositories";
import { getAuthUser } from "@/lib/http";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { verifyAuth } from "@/lib/auth";
import { withErrorHandler } from "@/middleware/error-handler";
import { errorResponses, successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const sendMessageSchema = z.object({
  receiver: z.string().min(1, "接收方不能为空"),
  content: z.string().min(1, "消息内容不能为空").max(2000, "消息内容最多 2000 个字符"),
});

/**
 * 获取当前用户的消息会话列表
 *
 * 返回与当前用户相关的所有私信会话，按最新消息时间倒序排列
 */
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

/**
 * 发送私信
 *
 * 将消息发送给指定用户，创建新的会话或追加到现有会话
 *
 * @param {string} receiver - 接收方用户名
 * @param {string} content - 消息内容，最多 2000 字符
 * @returns {string} conversation_id - 会话 ID
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await verifyAuth(req);
  if (!auth) {
    return errorResponses.unauthorized("请先登录");
  }

  const { receiver, content } = await validateBody(req, sendMessageSchema);

  try {
    const result = await messageRepository.sendMessage({ sender: auth.username, receiver, content });
    return successResponse({ conversation_id: result.conversationId });
  } catch (error) {
    if (error instanceof ApiError && error.code === ErrorCode.USER_NOT_FOUND) {
      return errorResponses.notFound("接收方不存在");
    }
    const message = error instanceof Error ? error.message : "发送消息失败";
    return errorResponses.badRequest(message);
  }
});
