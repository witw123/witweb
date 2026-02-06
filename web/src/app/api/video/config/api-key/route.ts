/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser, isAdminUser } from "@/lib/http";
import { setApiKey } from "@/lib/studio";
import {
  withErrorHandler,
  assertAuthenticated,
  assertAuthorized,
} from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const apiKeySchema = z.object({
  api_key: z.string().default(""),
});

export const POST = withErrorHandler(async (req) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);

  assertAuthorized(isAdminUser(user), "需要管理员权限");

  const body = await validateBody(req, apiKeySchema);

  setApiKey(body.api_key ?? "");

  return successResponse({ ok: true });
});

