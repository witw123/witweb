import { NextRequest } from "next/server";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { errorResponses, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleMessageRepository } from "@/lib/repositories";
import { validateParams, z } from "@/lib/validate";
import { withErrorHandler } from "@/middleware/error-handler";

const paramsSchema = z.object({
  conversationId: z.string().min(1, "会话 ID 不能为空"),
});

export const GET = withErrorHandler(
  async (
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
      const messages = await drizzleMessageRepository.getMessagesAndMarkAsRead(
        parseInt(conversationId, 10),
        user
      );
      return successResponse(messages);
    } catch (error) {
      if (error instanceof ApiError && error.code === ErrorCode.FORBIDDEN) {
        return errorResponses.forbidden("无权访问该会话");
      }
      throw error;
    }
  }
);
