/**
 * 友链单个操作 API
 *
 * 更新和删除指定友链
 *
 * @route /api/v1/friend-links/[id]
 * @method PUT - 更新指定友链
 * @method DELETE - 删除指定友链
 */
import { withErrorHandler } from "@/middleware/error-handler";
import {
  buildFriendLinkDeleteResponse,
  buildFriendLinkPutResponse,
} from "../../../friend-links/shared";

export const PUT = withErrorHandler(async (
  request: Request,
  context: { params: Promise<{ id: string }> }
) =>
  buildFriendLinkPutResponse(request, context.params)
);

export const DELETE = withErrorHandler(async (
  request: Request,
  context: { params: Promise<{ id: string }> }
) =>
  buildFriendLinkDeleteResponse(request, context.params)
);
