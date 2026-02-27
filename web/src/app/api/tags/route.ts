import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { initDb } from "@/lib/db-init";
import { postRepository } from "@/lib/repositories";

/**
 * GET /api/tags
 */
export const GET = withErrorHandler(async () => {
  initDb();

  const tagList = postRepository.listTagStats();

  return successResponse({
    tags: tagList,
    total: tagList.length,
  });
});
