/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser, isAdminUser } from "@/lib/http";
import { setHostMode } from "@/lib/studio";
import {
  withErrorHandler,
  assertAuthenticated,
  assertAuthorized,
} from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const hostModeSchema = z.object({
  host_mode: z.string().default("auto"),
});

export const POST = withErrorHandler(async (req) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);

  assertAuthorized(isAdminUser(user), "需要管理员权限");

  const body = await validateBody(req, hostModeSchema);

  setHostMode(body.host_mode ?? "auto");

  return successResponse({ ok: true });
});

