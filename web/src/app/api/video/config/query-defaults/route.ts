/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser, isAdminUser } from "@/lib/http";
import { setQueryDefaults } from "@/lib/studio";
import {
  withErrorHandler,
  assertAuthenticated,
  assertAuthorized,
} from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const queryDefaultsSchema = z.object({
  data: z.record(z.string(), z.unknown()).default({}),
});

export const POST = withErrorHandler(async (req) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);

  assertAuthorized(isAdminUser(user), "需要管理员权限");

  const body = await validateBody(req, queryDefaultsSchema);

  setQueryDefaults((body.data ?? {}) as Record<string, any>);

  return successResponse({ ok: true });
});

