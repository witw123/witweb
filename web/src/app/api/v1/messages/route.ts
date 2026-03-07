import { NextRequest } from "next/server";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { verifyAuth } from "@/lib/auth";
import { errorResponses, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleMessageRepository, drizzleUserRepository } from "@/lib/repositories";
import { validateBody, z } from "@/lib/validate";
import { withErrorHandler } from "@/middleware/error-handler";

const sendMessageSchema = z.object({
  receiver: z.string().min(1, "接收方不能为空"),
  content: z.string().min(1, "消息内容不能为空").max(2000, "消息内容最多 2000 个字符"),
});

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
