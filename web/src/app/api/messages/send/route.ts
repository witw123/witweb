import { NextRequest } from "next/server";
import { messageRepository } from "@/lib/repositories";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { verifyAuth } from "@/lib/auth";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const sendMessageSchema = z.object({
  receiver: z.string().min(1, "接收方不能为空"),
  content: z.string().min(1, "消息内容不能为空").max(2000, "消息内容最多 2000 个字符"),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await verifyAuth(req);
  if (!auth) {
    return errorResponses.unauthorized("请先登录");
  }

  const { receiver, content } = await validateBody(req, sendMessageSchema);

  try {
    const result = messageRepository.sendMessage({ sender: auth.username, receiver, content });
    return successResponse({ conversation_id: result.conversationId });
  } catch (error) {
    if (error instanceof ApiError && error.code === ErrorCode.USER_NOT_FOUND) {
      return errorResponses.notFound("接收方不存在");
    }
    const message = error instanceof Error ? error.message : "发送消息失败";
    return errorResponses.badRequest(message);
  }
});
