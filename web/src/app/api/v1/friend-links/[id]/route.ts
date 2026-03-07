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
