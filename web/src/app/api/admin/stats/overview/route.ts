/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { postRepository, userRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { isAdminUser } from "@/lib/http";

export const GET = withErrorHandler(async () => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "需要管理员权限");

  const stats = {
    total_users: userRepository.count(),
    total_blogs: postRepository.countAll(),
    total_published_blogs: postRepository.countByStatus("published"),
    total_draft_blogs: postRepository.countByStatus("draft"),
  };

  return successResponse(stats);
});
