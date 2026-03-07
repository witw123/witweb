import { withErrorHandler } from "@/middleware/error-handler";
import { buildFriendLinksGetResponse, buildFriendLinksPostResponse } from "../../friend-links/shared";

export const GET = withErrorHandler(async () => buildFriendLinksGetResponse());
export const POST = withErrorHandler(async (req) => buildFriendLinksPostResponse(req));
