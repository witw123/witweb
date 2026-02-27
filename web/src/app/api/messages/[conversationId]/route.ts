/**
 */

import { NextRequest } from "next/server";
import { messageRepository } from "@/lib/repositories";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { getAuthUser } from "@/lib/http";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  conversationId: z.string().min(1, "会话ID不能为空"),
});

export const GET = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) => {
  void req;
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  const { conversationId } = validateParams(await params, paramsSchema);

  try {
    const messages = messageRepository.getMessagesAndMarkAsRead(parseInt(conversationId, 10), user);
    return successResponse(messages);
  } catch (error) {
    if (error instanceof ApiError && error.code === ErrorCode.FORBIDDEN) {
      return errorResponses.forbidden("Access denied");
    }
    throw error;
  }
});
