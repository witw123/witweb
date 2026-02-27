import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { postRepository } from "@/lib/repositories";

/**
 * GET /api/tags
 */
export const GET = withErrorHandler(async () => {

  const tagList = await postRepository.listTagStats();

  return successResponse({
    tags: tagList,
    total: tagList.length,
  });
});
