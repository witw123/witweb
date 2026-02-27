import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { postRepository } from "@/lib/repositories";

export const GET = withErrorHandler(async () => {
  const { totalPosts, totalVisits, totalVisitors } = await postRepository.getSiteStats();

  return successResponse({
    totalPosts,
    totalVisits,
    totalVisitors,
  });
});
