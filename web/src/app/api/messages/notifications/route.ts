/**
 */

import { NextRequest } from "next/server";
import { getRepliesToUser, getLikesToUser, getMentionsToUser, getSystemNotifications } from "@/lib/blog";
import { getAuthUser } from "@/lib/http";
import { withErrorHandler } from "@/middleware/error-handler";
import { errorResponses, paginatedResponse } from "@/lib/api-response";
import { validateQuery, z } from "@/lib/validate";

const querySchema = z.object({
  type: z.enum(["replies", "likes", "at", "system"]).default("replies"),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  // 验证用户认证
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  const { type, page, size } = await validateQuery(req, querySchema);

  // 获取对应类型通知
  let items: any[] = [];
  let total = 0;

  if (type === "replies") {
    items = getRepliesToUser(user, page, size);
    total = items.length;
  } else if (type === "likes") {
    items = getLikesToUser(user, page, size);
    total = items.length;
  } else if (type === "at") {
    items = getMentionsToUser(user, page, size);
    total = items.length;
  } else if (type === "system") {
    items = getSystemNotifications(user);
    total = items.length;
  }

  return paginatedResponse(items, total, page ?? 1, size ?? 20);
});
