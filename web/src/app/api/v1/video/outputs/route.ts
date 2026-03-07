import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { getLocalVideos } from "@/lib/studio";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const videos = await getLocalVideos();
  return successResponse(videos);
});
