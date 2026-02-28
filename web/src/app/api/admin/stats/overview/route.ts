import { getAuthIdentity } from "@/lib/http";
import { postRepository, userRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { hasAdminPermission } from "@/lib/rbac";

export const GET = withErrorHandler(async () => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "dashboard.view"), "需要仪表盘查看权限");

  const stats = {
    total_users: await userRepository.count(),
    total_blogs: await postRepository.countAll(),
    total_published_blogs: await postRepository.countByStatus("published"),
    total_draft_blogs: await postRepository.countByStatus("draft"),
  };

  return successResponse(stats);
});

