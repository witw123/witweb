/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { statsOverview } from "@/lib/admin";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { isAdminUser } from "@/lib/http";

export const GET = withErrorHandler(async () => {
  initDb();
  
  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "需要管理员权限");
  
  const stats = statsOverview();
  
  return successResponse(stats);
});

