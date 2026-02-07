/**
 */

import { NextRequest } from "next/server";
import { getMessages } from "@/lib/messages";
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
  // 验证用户登录状态
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  const { conversationId } = validateParams(await params, paramsSchema);

  const messages = getMessages(parseInt(conversationId), user);

  return successResponse(messages);
});
