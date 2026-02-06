/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser, isAdminUser } from "@/lib/http";
import { getConfig } from "@/lib/studio";
import {
  withErrorHandler,
  assertAuthenticated,
  assertAuthorized,
} from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);

  assertAuthorized(isAdminUser(user), "需要管理员权限");

  const cfg = getConfig() as { host_mode?: string; query_defaults?: Record<string, unknown> };

  return successResponse({
    host_mode: cfg.host_mode || "auto",
    query_defaults: cfg.query_defaults || {},
  });
});

