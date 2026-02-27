/**
 */

import { getAuthUser } from "@/lib/http";
import { postRepository, userRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { isAdminUser } from "@/lib/http";

export const GET = withErrorHandler(async () => {

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "需要管理员权限");

  const stats = {
    total_users: await userRepository.count(),
    total_blogs: await postRepository.countAll(),
    total_published_blogs: await postRepository.countByStatus("published"),
    total_draft_blogs: await postRepository.countByStatus("draft"),
  };

  return successResponse(stats);
});
