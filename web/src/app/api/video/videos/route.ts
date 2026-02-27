/**
 */

import { getAuthUser } from "@/lib/http";
import { getLocalVideos } from "@/lib/studio";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {

  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const videos = await getLocalVideos();

  return successResponse(videos);
});

